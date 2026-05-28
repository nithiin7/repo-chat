"""
FastAPI application entry point — CodeLens API.

Routes
------
POST   /index              Fetch + index a GitHub or Bitbucket repository.
POST   /chat               Stream an SSE answer about an indexed repo.
GET    /repos              List all indexed repositories.
DELETE /repos/{repo_id}    Remove a repo's index, source tree, and metadata.

SSE token format
----------------
Each streamed token is JSON-encoded on a single data line:
    data: "hello"\n\n
    data: " world"\n\n
    data: [DONE]\n\n          ← stream complete
    data: [ERROR] <msg>\n\n   ← backend error; stream ends after this
"""

import asyncio
import hashlib
import json
import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, HttpUrl

from backend.config import get_settings, save_settings_overlay
from backend.core.fetcher import FetchResult, RepoFetchError, fetch_repo
from backend.core.indexer import build_index, delete_index
from backend.core.llm import LLMError, LLMMode, stream_answer
from backend.core.retriever import SourceChunk, retrieve

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class IndexRequest(BaseModel):
    repo_url: HttpUrl


class IndexResponse(BaseModel):
    repo_id: str
    file_count: int
    status: str


class ChatRequest(BaseModel):
    repo_id: str
    question: str
    mode: LLMMode = LLMMode.LOCAL


class RepoInfo(BaseModel):
    repo_id: str
    name: str
    url: str
    indexed_at: str
    file_count: int


class SettingsView(BaseModel):
    """Safe settings representation — API keys replaced by presence booleans."""
    ollama_base_url: str
    ollama_model: str
    cloud_provider: str
    anthropic_model: str
    has_anthropic_key: bool
    openai_model: str
    openai_base_url: str
    has_openai_key: bool


class SettingsUpdate(BaseModel):
    ollama_model: str | None = None
    cloud_provider: str | None = None
    anthropic_model: str | None = None
    anthropic_api_key: str | None = None
    openai_model: str | None = None
    openai_base_url: str | None = None
    openai_api_key: str | None = None


# ---------------------------------------------------------------------------
# App & CORS
# ---------------------------------------------------------------------------

app = FastAPI(title="CodeLens API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Metadata store
#
# A single repos.json file lives alongside the cloned repos.  All reads and
# writes happen inside async route handlers (the event loop), so no locking
# is required.
# ---------------------------------------------------------------------------

def _metadata_path() -> Path:
    return Path(get_settings().repos_dir) / "repos.json"


def _read_metadata() -> dict[str, dict]:
    path = _metadata_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _write_metadata(data: dict[str, dict]) -> None:
    path = _metadata_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _repo_id_from_url(url: str) -> str:
    """Stable 16-char hex ID so the same URL always maps to the same repo_id."""
    return hashlib.sha256(url.lower().rstrip("/").encode()).hexdigest()[:16]


# ---------------------------------------------------------------------------
# POST /index
# ---------------------------------------------------------------------------

@app.post("/index", response_model=IndexResponse)
async def index_repo(body: IndexRequest):
    """
    Clone and index a remote repository.

    If the same URL was indexed before, returns the cached metadata immediately
    without re-cloning or re-embedding.
    """
    url = str(body.repo_url)
    repo_id = _repo_id_from_url(url)

    existing = _read_metadata()
    if repo_id in existing:
        return IndexResponse(
            repo_id=repo_id,
            file_count=existing[repo_id]["file_count"],
            status="already_indexed",
        )

    # Clone — network + disk I/O, run off the event loop.
    try:
        result: FetchResult = await asyncio.to_thread(fetch_repo, url)
    except RepoFetchError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Embed + persist to ChromaDB — CPU-heavy, run off the event loop.
    try:
        await asyncio.to_thread(build_index, result.file_paths, repo_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Persist metadata back in the event loop.
    existing[repo_id] = {
        "repo_id": repo_id,
        "name": result.repo_name,
        "url": url,
        "indexed_at": datetime.now(timezone.utc).isoformat(),
        "file_count": len(result.file_paths),
    }
    _write_metadata(existing)

    return IndexResponse(
        repo_id=repo_id,
        file_count=len(result.file_paths),
        status="indexed",
    )


# ---------------------------------------------------------------------------
# POST /chat
# ---------------------------------------------------------------------------

@app.post("/chat")
async def chat(body: ChatRequest):
    """
    Stream an SSE response answering body.question about body.repo_id.

    Token format — each event is one of:
        data: "<token>"\n\n        raw JSON-encoded string
        data: [DONE]\n\n           stream finished successfully
        data: [ERROR] <msg>\n\n    error occurred; stream ends here
    """
    metadata = _read_metadata()
    if body.repo_id not in metadata:
        raise HTTPException(
            status_code=404,
            detail=f"Repo '{body.repo_id}' not indexed. Call POST /index first.",
        )

    async def event_stream() -> AsyncGenerator[str, None]:
        try:
            # Retrieval is synchronous (vector search) — off the event loop.
            source_chunks: list[SourceChunk] = await asyncio.to_thread(
                retrieve, body.repo_id, body.question
            )

            # Emit sources before streaming tokens so the UI can show them.
            yield f"event: sources\ndata: {json.dumps(source_chunks)}\n\n"

            text_chunks = [sc["chunk"] for sc in source_chunks]
            async for token in stream_answer(body.question, text_chunks, body.mode):
                # JSON-encode so embedded newlines don't break SSE framing.
                yield f"data: {json.dumps(token)}\n\n"

        except LLMError as exc:
            logger.warning("LLM error for repo '%s': %s", body.repo_id, exc)
            yield f"data: [ERROR] {exc}\n\n"
        except Exception as exc:
            logger.exception(
                "Unexpected error in /chat for repo '%s'", body.repo_id
            )
            yield f"data: [ERROR] Internal server error.\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Tells nginx/proxies not to buffer the stream.
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# GET /repos
# ---------------------------------------------------------------------------

@app.get("/repos", response_model=list[RepoInfo])
async def list_repos():
    """Return all indexed repositories, sorted newest first."""
    metadata = _read_metadata()
    repos = [RepoInfo(**entry) for entry in metadata.values()]
    repos.sort(key=lambda r: r.indexed_at, reverse=True)
    return repos


# ---------------------------------------------------------------------------
# DELETE /repos/{repo_id}
# ---------------------------------------------------------------------------

@app.delete("/repos/{repo_id}")
async def delete_repo(repo_id: str):
    """
    Remove a repo's ChromaDB collection, cloned source tree, and metadata entry.
    """
    metadata = _read_metadata()
    if repo_id not in metadata:
        raise HTTPException(
            status_code=404,
            detail=f"Repo '{repo_id}' not found.",
        )

    entry = metadata[repo_id]

    # Drop ChromaDB collection.
    await asyncio.to_thread(delete_index, repo_id)

    # Remove the cloned source tree.
    repo_dir = Path(get_settings().repos_dir) / entry["name"]
    if repo_dir.exists():
        await asyncio.to_thread(shutil.rmtree, str(repo_dir), True)

    # Update metadata.
    del metadata[repo_id]
    _write_metadata(metadata)

    return {"status": "deleted", "repo_id": repo_id}


# ---------------------------------------------------------------------------
# GET /ollama/models
# ---------------------------------------------------------------------------

@app.get("/ollama/models")
async def ollama_models():
    """
    Proxy Ollama's /api/tags endpoint and return a flat list of model names.
    Returns an empty list if Ollama is not running rather than erroring.
    """
    settings = get_settings()
    url = f"{settings.ollama_base_url.rstrip('/')}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url)
            if response.status_code != 200:
                return {"models": []}
            data = response.json()
            names = [m["name"] for m in data.get("models", [])]
            return {"models": names}
    except Exception:
        return {"models": []}


# ---------------------------------------------------------------------------
# GET /settings
# ---------------------------------------------------------------------------

@app.get("/settings", response_model=SettingsView)
async def get_settings_view():
    """Return current settings with API keys replaced by presence booleans."""
    s = get_settings()
    return SettingsView(
        ollama_base_url=s.ollama_base_url,
        ollama_model=s.ollama_model,
        cloud_provider=s.cloud_provider,
        anthropic_model=s.anthropic_model,
        has_anthropic_key=bool(s.anthropic_api_key),
        openai_model=s.openai_model,
        openai_base_url=s.openai_base_url,
        has_openai_key=bool(s.openai_api_key),
    )


# ---------------------------------------------------------------------------
# PUT /settings
# ---------------------------------------------------------------------------

@app.put("/settings", response_model=SettingsView)
async def update_settings(body: SettingsUpdate):
    """Persist user-configurable settings to settings.json overlay."""
    updates: dict = {}

    if body.ollama_model is not None:
        updates["ollama_model"] = body.ollama_model
    if body.cloud_provider is not None:
        if body.cloud_provider not in ("anthropic", "openai"):
            raise HTTPException(status_code=422, detail="cloud_provider must be 'anthropic' or 'openai'")
        updates["cloud_provider"] = body.cloud_provider
    if body.anthropic_model is not None:
        updates["anthropic_model"] = body.anthropic_model
    if body.anthropic_api_key is not None:
        updates["anthropic_api_key"] = body.anthropic_api_key
    if body.openai_model is not None:
        updates["openai_model"] = body.openai_model
    if body.openai_base_url is not None:
        updates["openai_base_url"] = body.openai_base_url
    if body.openai_api_key is not None:
        updates["openai_api_key"] = body.openai_api_key

    if updates:
        save_settings_overlay(updates)

    s = get_settings()
    return SettingsView(
        ollama_base_url=s.ollama_base_url,
        ollama_model=s.ollama_model,
        cloud_provider=s.cloud_provider,
        anthropic_model=s.anthropic_model,
        has_anthropic_key=bool(s.anthropic_api_key),
        openai_model=s.openai_model,
        openai_base_url=s.openai_base_url,
        has_openai_key=bool(s.openai_api_key),
    )
