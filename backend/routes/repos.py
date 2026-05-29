import asyncio
import hashlib
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from backend.config import get_settings
from backend.core.fetcher import FetchResult, RepoFetchError, fetch_repo, get_remote_head
from backend.core.indexer import build_index, delete_index
from backend.core.retriever import retrieve
from backend.persistence import (
    create_chat,
    delete_chats_for_repo,
    delete_repo,
    get_repo,
    list_chats,
    list_repos,
    upsert_repo,
)
from backend.schemas import (
    ChatInfo,
    CreateChatRequest,
    IndexRequest,
    IndexResponse,
    RepoInfo,
    RepoStatusResponse,
    SearchResponse,
    SearchResultItem,
)

router = APIRouter()


def _repo_id_from_url(url: str) -> str:
    return hashlib.sha256(url.lower().rstrip("/").encode()).hexdigest()[:16]


@router.post("/index", response_model=IndexResponse)
async def index_repo(body: IndexRequest):
    url = str(body.repo_url)
    repo_id = _repo_id_from_url(url)

    existing = await asyncio.to_thread(get_repo, repo_id)
    if existing and not body.force:
        return IndexResponse(
            repo_id=repo_id,
            file_count=existing["file_count"],
            status="already_indexed",
        )

    if existing and body.force:
        await asyncio.to_thread(delete_index, repo_id)
        repo_dir = Path(get_settings().repos_dir) / existing["name"]
        if repo_dir.exists():
            await asyncio.to_thread(shutil.rmtree, str(repo_dir), True)

    try:
        result: FetchResult = await asyncio.to_thread(fetch_repo, url)
    except RepoFetchError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    try:
        await asyncio.to_thread(build_index, result.file_paths, repo_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    await asyncio.to_thread(
        upsert_repo,
        repo_id,
        result.repo_name,
        url,
        datetime.now(timezone.utc).isoformat(),
        len(result.file_paths),
        result.head_commit or None,
    )

    return IndexResponse(
        repo_id=repo_id,
        file_count=len(result.file_paths),
        status="reindexed" if body.force else "indexed",
    )


@router.get("/repos", response_model=list[RepoInfo])
async def list_repos_route():
    repos = await asyncio.to_thread(list_repos)
    return [RepoInfo(**r) for r in repos]


@router.delete("/repos/{repo_id}")
async def delete_repo_route(repo_id: str):
    existing = await asyncio.to_thread(get_repo, repo_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Repo '{repo_id}' not found.")

    await asyncio.to_thread(delete_index, repo_id)

    repo_dir = Path(get_settings().repos_dir) / existing["name"]
    if repo_dir.exists():
        await asyncio.to_thread(shutil.rmtree, str(repo_dir), True)

    await asyncio.to_thread(delete_chats_for_repo, repo_id)
    await asyncio.to_thread(delete_repo, repo_id)

    return {"status": "deleted", "repo_id": repo_id}


@router.get("/repos/{repo_id}/status", response_model=RepoStatusResponse)
async def repo_status(repo_id: str):
    existing = await asyncio.to_thread(get_repo, repo_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Repo '{repo_id}' not found.")

    indexed_commit: str | None = existing.get("last_indexed_commit")
    url: str = existing["url"]

    remote_commit = await asyncio.to_thread(get_remote_head, url)

    has_updates = bool(indexed_commit and remote_commit and indexed_commit != remote_commit)

    return RepoStatusResponse(
        repo_id=repo_id,
        has_updates=has_updates,
        indexed_commit=indexed_commit,
        remote_commit=remote_commit,
    )


@router.get("/repos/{repo_id}/chats", response_model=list[ChatInfo])
async def list_repo_chats(repo_id: str):
    chats = await asyncio.to_thread(list_chats, repo_id)
    return [ChatInfo(**c) for c in chats]


@router.post("/repos/{repo_id}/chats", response_model=ChatInfo)
async def create_repo_chat(repo_id: str, body: CreateChatRequest = CreateChatRequest()):
    existing = await asyncio.to_thread(get_repo, repo_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Repo '{repo_id}' not indexed.")
    chat = await asyncio.to_thread(create_chat, repo_id, body.title)
    return ChatInfo(**chat)


@router.get("/repos/{repo_id}/search", response_model=SearchResponse)
async def search_repo(
    repo_id: str,
    query: str = Query(..., min_length=1),
    top_k: int = Query(default=10, ge=1, le=50),
):
    existing = await asyncio.to_thread(get_repo, repo_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Repo '{repo_id}' not indexed.")
    chunks = await asyncio.to_thread(retrieve, repo_id, query, top_k)
    return SearchResponse(
        repo_id=repo_id,
        query=query,
        results=[SearchResultItem(**c) for c in chunks],
    )
