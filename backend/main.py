"""
FastAPI application entry point — CodeLens API.

Routes
------
POST   /index                       Fetch + index a GitHub or Bitbucket repository.
POST   /chat                        Stream an SSE answer about an indexed repo.
GET    /repos                       List all indexed repositories.
DELETE /repos/{repo_id}             Remove a repo's index, source tree, and metadata.
GET    /repos/{repo_id}/chats       List saved chats for a repo.
POST   /repos/{repo_id}/chats       Create a new chat session for a repo.
PATCH  /chats/{chat_id}             Rename a chat.
DELETE /chats/{chat_id}             Delete a chat and all its messages.
GET    /chats/{chat_id}/messages    Return saved messages for a chat.

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
from backend.core.fetcher import FetchResult, RepoFetchError, fetch_repo, get_remote_head
from backend.core.indexer import build_index, delete_index
from backend.core.llm import LLMError, LLMMode, stream_answer
from backend.core.retriever import SourceChunk, retrieve
from backend import db

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class IndexRequest(BaseModel):
    repo_url: HttpUrl
    force: bool = False


class IndexResponse(BaseModel):
    repo_id: str
    file_count: int
    status: str


class ChatRequest(BaseModel):
    repo_id: str
    question: str
    mode: LLMMode = LLMMode.LOCAL
    chat_id: str | None = None


class RepoInfo(BaseModel):
    repo_id: str
    name: str
    url: str
    indexed_at: str
    file_count: int
    last_indexed_commit: str | None = None


class RepoStatusResponse(BaseModel):
    repo_id: str
    has_updates: bool
    indexed_commit: str | None = None
    remote_commit: str | None = None


class ChatInfo(BaseModel):
    id: str
    repo_id: str
    title: str
    created_at: str
    updated_at: str


class CreateChatRequest(BaseModel):
    title: str = "New Chat"


class RenameChatRequest(BaseModel):
    title: str


class ChatMessageInfo(BaseModel):
    id: str
    chat_id: str
    role: str
    content: str
    sources: list | None = None
    created_at: str


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
    groq_model: str
    has_groq_key: bool
    gemini_model: str
    has_gemini_key: bool


class SettingsUpdate(BaseModel):
    ollama_model: str | None = None
    cloud_provider: str | None = None
    anthropic_model: str | None = None
    anthropic_api_key: str | None = None
    openai_model: str | None = None
    openai_base_url: str | None = None
    openai_api_key: str | None = None
    groq_model: str | None = None
    groq_api_key: str | None = None
    gemini_model: str | None = None
    gemini_api_key: str | None = None


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


@app.on_event("startup")
async def startup():
    db.init_db()


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
    if repo_id in existing and not body.force:
        return IndexResponse(
            repo_id=repo_id,
            file_count=existing[repo_id]["file_count"],
            status="already_indexed",
        )

    # If force re-indexing, tear down the old data first.
    if repo_id in existing and body.force:
        await asyncio.to_thread(delete_index, repo_id)
        repo_dir = Path(get_settings().repos_dir) / existing[repo_id]["name"]
        if repo_dir.exists():
            await asyncio.to_thread(shutil.rmtree, str(repo_dir), True)

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
        "last_indexed_commit": result.head_commit or None,
    }
    _write_metadata(existing)

    return IndexResponse(
        repo_id=repo_id,
        file_count=len(result.file_paths),
        status="reindexed" if body.force else "indexed",
    )


# ---------------------------------------------------------------------------
# POST /chat
# ---------------------------------------------------------------------------

@app.post("/chat")
async def chat(body: ChatRequest):
    """
    Stream an SSE response answering body.question about body.repo_id.

    If body.chat_id is provided, the user question and complete assistant
    response are persisted to the SQLite database.

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

    # Persist user message and auto-title the chat before streaming.
    if body.chat_id:
        await asyncio.to_thread(db.save_message, body.chat_id, "user", body.question)
        await asyncio.to_thread(db.set_chat_title_if_default, body.chat_id, body.question)

    async def event_stream() -> AsyncGenerator[str, None]:
        accumulated: list[str] = []
        saved_sources: list | None = None
        try:
            # Retrieval is synchronous (vector search) — off the event loop.
            source_chunks: list[SourceChunk] = await asyncio.to_thread(
                retrieve, body.repo_id, body.question
            )
            saved_sources = source_chunks

            # Emit sources before streaming tokens so the UI can show them.
            yield f"event: sources\ndata: {json.dumps(source_chunks)}\n\n"

            text_chunks = [sc["chunk"] for sc in source_chunks]
            async for token in stream_answer(body.question, text_chunks, body.mode):
                accumulated.append(token)
                # JSON-encode so embedded newlines don't break SSE framing.
                yield f"data: {json.dumps(token)}\n\n"

        except LLMError as exc:
            logger.warning("LLM error for repo '%s': %s", body.repo_id, exc)
            yield f"data: [ERROR] {exc}\n\n"
        except Exception:
            logger.exception(
                "Unexpected error in /chat for repo '%s'", body.repo_id
            )
            yield f"data: [ERROR] Internal server error.\n\n"
        finally:
            # Persist the complete assistant response if we have a chat session.
            if body.chat_id and accumulated:
                full_response = "".join(accumulated)
                await asyncio.to_thread(
                    db.save_message,
                    body.chat_id,
                    "assistant",
                    full_response,
                    saved_sources,
                )
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
    Remove a repo's ChromaDB collection, cloned source tree, metadata entry,
    and all saved chats/messages.
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

    # Remove all saved chats for this repo.
    await asyncio.to_thread(db.delete_chats_for_repo, repo_id)

    # Update metadata.
    del metadata[repo_id]
    _write_metadata(metadata)

    return {"status": "deleted", "repo_id": repo_id}


# ---------------------------------------------------------------------------
# GET /repos/{repo_id}/status
# ---------------------------------------------------------------------------

@app.get("/repos/{repo_id}/status", response_model=RepoStatusResponse)
async def repo_status(repo_id: str):
    """
    Check whether the remote repo has new commits since the last index.

    Runs git ls-remote against the remote without cloning.  Returns
    has_updates=False if the indexed commit is unknown (legacy entry) or
    if the remote cannot be reached.
    """
    metadata = _read_metadata()
    if repo_id not in metadata:
        raise HTTPException(status_code=404, detail=f"Repo '{repo_id}' not found.")

    entry = metadata[repo_id]
    indexed_commit: str | None = entry.get("last_indexed_commit")
    url: str = entry["url"]

    remote_commit = await asyncio.to_thread(get_remote_head, url)

    has_updates = bool(
        indexed_commit
        and remote_commit
        and indexed_commit != remote_commit
    )

    return RepoStatusResponse(
        repo_id=repo_id,
        has_updates=has_updates,
        indexed_commit=indexed_commit,
        remote_commit=remote_commit,
    )


# ---------------------------------------------------------------------------
# GET /repos/{repo_id}/chats
# ---------------------------------------------------------------------------

@app.get("/repos/{repo_id}/chats", response_model=list[ChatInfo])
async def list_repo_chats(repo_id: str):
    """Return all chats for a repo, sorted newest first."""
    chats = await asyncio.to_thread(db.list_chats, repo_id)
    return [ChatInfo(**c) for c in chats]


# ---------------------------------------------------------------------------
# POST /repos/{repo_id}/chats
# ---------------------------------------------------------------------------

@app.post("/repos/{repo_id}/chats", response_model=ChatInfo)
async def create_repo_chat(repo_id: str, body: CreateChatRequest = CreateChatRequest()):
    """Create a new chat session for a repo."""
    metadata = _read_metadata()
    if repo_id not in metadata:
        raise HTTPException(
            status_code=404,
            detail=f"Repo '{repo_id}' not indexed.",
        )
    chat = await asyncio.to_thread(db.create_chat, repo_id, body.title)
    return ChatInfo(**chat)


# ---------------------------------------------------------------------------
# PATCH /chats/{chat_id}
# ---------------------------------------------------------------------------

@app.patch("/chats/{chat_id}", response_model=ChatInfo)
async def rename_chat(chat_id: str, body: RenameChatRequest):
    """Rename a chat."""
    chat = await asyncio.to_thread(db.get_chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail=f"Chat '{chat_id}' not found.")
    await asyncio.to_thread(db.rename_chat, chat_id, body.title)
    updated = await asyncio.to_thread(db.get_chat, chat_id)
    return ChatInfo(**updated)


# ---------------------------------------------------------------------------
# DELETE /chats/{chat_id}
# ---------------------------------------------------------------------------

@app.delete("/chats/{chat_id}")
async def delete_chat(chat_id: str):
    """Delete a chat and all its messages."""
    chat = await asyncio.to_thread(db.get_chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail=f"Chat '{chat_id}' not found.")
    await asyncio.to_thread(db.delete_chat, chat_id)
    return {"status": "deleted", "chat_id": chat_id}


# ---------------------------------------------------------------------------
# GET /chats/{chat_id}/messages
# ---------------------------------------------------------------------------

@app.get("/chats/{chat_id}/messages", response_model=list[ChatMessageInfo])
async def get_chat_messages(chat_id: str):
    """Return all messages for a chat in chronological order."""
    chat = await asyncio.to_thread(db.get_chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail=f"Chat '{chat_id}' not found.")
    messages = await asyncio.to_thread(db.list_messages, chat_id)
    return [ChatMessageInfo(**m) for m in messages]


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
        groq_model=s.groq_model,
        has_groq_key=bool(s.groq_api_key),
        gemini_model=s.gemini_model,
        has_gemini_key=bool(s.gemini_api_key),
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
        if body.cloud_provider not in ("anthropic", "openai", "groq", "gemini"):
            raise HTTPException(status_code=422, detail="cloud_provider must be 'anthropic', 'openai', 'groq', or 'gemini'")
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
    if body.groq_model is not None:
        updates["groq_model"] = body.groq_model
    if body.groq_api_key is not None:
        updates["groq_api_key"] = body.groq_api_key
    if body.gemini_model is not None:
        updates["gemini_model"] = body.gemini_model
    if body.gemini_api_key is not None:
        updates["gemini_api_key"] = body.gemini_api_key

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
        groq_model=s.groq_model,
        has_groq_key=bool(s.groq_api_key),
        gemini_model=s.gemini_model,
        has_gemini_key=bool(s.gemini_api_key),
    )
