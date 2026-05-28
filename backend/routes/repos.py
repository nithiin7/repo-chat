import asyncio
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException

from backend.config import get_settings
from backend.core.fetcher import FetchResult, RepoFetchError, fetch_repo, get_remote_head
from backend.core.indexer import build_index, delete_index
from backend.persistence import db
from backend.schemas import (
    ChatInfo,
    CreateChatRequest,
    IndexRequest,
    IndexResponse,
    RepoInfo,
    RepoStatusResponse,
)
from backend.core.store import read_metadata, repo_id_from_url, write_metadata

router = APIRouter()


@router.post("/index", response_model=IndexResponse)
async def index_repo(body: IndexRequest):
    url = str(body.repo_url)
    repo_id = repo_id_from_url(url)

    existing = read_metadata()
    if repo_id in existing and not body.force:
        return IndexResponse(
            repo_id=repo_id,
            file_count=existing[repo_id]["file_count"],
            status="already_indexed",
        )

    if repo_id in existing and body.force:
        await asyncio.to_thread(delete_index, repo_id)
        repo_dir = Path(get_settings().repos_dir) / existing[repo_id]["name"]
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

    existing[repo_id] = {
        "repo_id": repo_id,
        "name": result.repo_name,
        "url": url,
        "indexed_at": datetime.now(timezone.utc).isoformat(),
        "file_count": len(result.file_paths),
        "last_indexed_commit": result.head_commit or None,
    }
    write_metadata(existing)

    return IndexResponse(
        repo_id=repo_id,
        file_count=len(result.file_paths),
        status="reindexed" if body.force else "indexed",
    )


@router.get("/repos", response_model=list[RepoInfo])
async def list_repos():
    metadata = read_metadata()
    repos = [RepoInfo(**entry) for entry in metadata.values()]
    repos.sort(key=lambda r: r.indexed_at, reverse=True)
    return repos


@router.delete("/repos/{repo_id}")
async def delete_repo(repo_id: str):
    metadata = read_metadata()
    if repo_id not in metadata:
        raise HTTPException(status_code=404, detail=f"Repo '{repo_id}' not found.")

    entry = metadata[repo_id]

    await asyncio.to_thread(delete_index, repo_id)

    repo_dir = Path(get_settings().repos_dir) / entry["name"]
    if repo_dir.exists():
        await asyncio.to_thread(shutil.rmtree, str(repo_dir), True)

    await asyncio.to_thread(db.delete_chats_for_repo, repo_id)

    del metadata[repo_id]
    write_metadata(metadata)

    return {"status": "deleted", "repo_id": repo_id}


@router.get("/repos/{repo_id}/status", response_model=RepoStatusResponse)
async def repo_status(repo_id: str):
    metadata = read_metadata()
    if repo_id not in metadata:
        raise HTTPException(status_code=404, detail=f"Repo '{repo_id}' not found.")

    entry = metadata[repo_id]
    indexed_commit: str | None = entry.get("last_indexed_commit")
    url: str = entry["url"]

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
    chats = await asyncio.to_thread(db.list_chats, repo_id)
    return [ChatInfo(**c) for c in chats]


@router.post("/repos/{repo_id}/chats", response_model=ChatInfo)
async def create_repo_chat(repo_id: str, body: CreateChatRequest = CreateChatRequest()):
    metadata = read_metadata()
    if repo_id not in metadata:
        raise HTTPException(status_code=404, detail=f"Repo '{repo_id}' not indexed.")
    chat = await asyncio.to_thread(db.create_chat, repo_id, body.title)
    return ChatInfo(**chat)
