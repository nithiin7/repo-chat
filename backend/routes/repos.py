import asyncio
import hashlib
import json
import shutil
from datetime import UTC, datetime
from pathlib import Path

from backend.config import get_settings
from backend.core.fetcher import (
    FetchResult,
    RepoFetchError,
    collect_files,
    fetch_repo,
    get_remote_head,
    pull_repo,
)
from backend.core.hybrid_retriever import hybrid_retrieve
from backend.core.indexer import build_index, delete_index, sync_index
from backend.persistence import (
    create_chat,
    delete_chats_for_repo,
    delete_repo,
    get_repo,
    list_chats,
    list_file_paths,
    list_repos,
    list_symbols,
    search_symbols,
    upsert_repo,
)
from backend.schemas import (
    ChatInfo,
    ComplexityHotspot,
    CreateChatRequest,
    DepEdge,
    DepGraphResponse,
    DepNode,
    HealthSummaryResponse,
    IndexRequest,
    IndexResponse,
    NavigateResponse,
    RepoInfo,
    RepoStatusResponse,
    SearchResponse,
    SearchResultItem,
    SymbolItem,
    TestCoverageEstimate,
    TodoItem,
)
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

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
        result: FetchResult = await asyncio.to_thread(
            fetch_repo, url, github_token=body.github_token, branch=body.branch
        )
    except RepoFetchError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        await asyncio.to_thread(build_index, result.file_paths, repo_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    await asyncio.to_thread(
        upsert_repo,
        repo_id,
        result.repo_name,
        url,
        datetime.now(UTC).isoformat(),
        len(result.file_paths),
        result.head_commit or None,
        body.branch,
    )

    return IndexResponse(
        repo_id=repo_id,
        file_count=len(result.file_paths),
        status="reindexed" if body.force else "indexed",
    )


@router.post("/index/stream")
async def index_repo_stream(body: IndexRequest):
    url = str(body.repo_url)
    repo_id = _repo_id_from_url(url)

    async def event_stream():
        queue: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def on_progress(current: int, total: int, name: str) -> None:
            loop.call_soon_threadsafe(
                queue.put_nowait,
                {"type": "file", "current": current, "total": total, "name": name},
            )

        async def run() -> None:
            try:
                existing = await asyncio.to_thread(get_repo, repo_id)
                if existing and not body.force:
                    await queue.put(
                        {
                            "type": "done",
                            "repo_id": repo_id,
                            "file_count": existing["file_count"],
                            "status": "already_indexed",
                        }
                    )
                    return

                if existing and body.force:
                    await asyncio.to_thread(delete_index, repo_id)
                    repo_dir = Path(get_settings().repos_dir) / existing["name"]
                    if repo_dir.exists():
                        await asyncio.to_thread(shutil.rmtree, str(repo_dir), True)

                await queue.put({"type": "cloning"})

                try:
                    result: FetchResult = await asyncio.to_thread(
                        fetch_repo, url, github_token=body.github_token, branch=body.branch
                    )
                except RepoFetchError as exc:
                    await queue.put({"type": "error", "message": str(exc)})
                    return

                await queue.put({"type": "files_found", "total": len(result.file_paths)})

                try:
                    await asyncio.to_thread(build_index, result.file_paths, repo_id, on_progress)
                except ValueError as exc:
                    await queue.put({"type": "error", "message": str(exc)})
                    return

                await asyncio.to_thread(
                    upsert_repo,
                    repo_id,
                    result.repo_name,
                    url,
                    datetime.now(UTC).isoformat(),
                    len(result.file_paths),
                    result.head_commit or None,
                    body.branch,
                )

                await queue.put(
                    {
                        "type": "done",
                        "repo_id": repo_id,
                        "file_count": len(result.file_paths),
                        "status": "reindexed" if body.force else "indexed",
                    }
                )
            except Exception as exc:
                await queue.put({"type": "error", "message": str(exc)})

        task = asyncio.create_task(run())

        try:
            while True:
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"
                if event["type"] in ("done", "error"):
                    break
        finally:
            if not task.done():
                task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
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
    branch: str | None = existing.get("branch")

    remote_commit = await asyncio.to_thread(get_remote_head, url, branch)

    has_updates = bool(indexed_commit and remote_commit and indexed_commit != remote_commit)

    return RepoStatusResponse(
        repo_id=repo_id,
        has_updates=has_updates,
        indexed_commit=indexed_commit,
        remote_commit=remote_commit,
    )


@router.post("/repos/{repo_id}/sync/stream")
async def sync_repo_stream(repo_id: str):
    async def event_stream():
        queue: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def on_progress(current: int, total: int, name: str) -> None:
            loop.call_soon_threadsafe(
                queue.put_nowait,
                {"type": "file", "current": current, "total": total, "name": name},
            )

        async def run() -> None:
            try:
                existing = await asyncio.to_thread(get_repo, repo_id)
                if not existing:
                    await queue.put({"type": "error", "message": f"Repo '{repo_id}' not found."})
                    return

                await queue.put({"type": "pulling"})
                local_path = Path(get_settings().repos_dir) / existing["name"]

                try:
                    sync_result = await asyncio.to_thread(
                        pull_repo, local_path, branch=existing.get("branch")
                    )
                except RepoFetchError as exc:
                    await queue.put({"type": "error", "message": str(exc)})
                    return

                if sync_result.old_commit == sync_result.new_commit:
                    await queue.put(
                        {
                            "type": "done",
                            "repo_id": repo_id,
                            "changed_count": 0,
                            "deleted_count": 0,
                            "status": "up_to_date",
                        }
                    )
                    return

                total = len(sync_result.changed_files) + len(sync_result.deleted_files)
                await queue.put({"type": "files_found", "total": total})

                try:
                    _, files_reindexed = await asyncio.to_thread(
                        sync_index,
                        sync_result.changed_files,
                        sync_result.deleted_files,
                        repo_id,
                        on_progress,
                    )
                except Exception as exc:
                    await queue.put({"type": "error", "message": str(exc)})
                    return

                all_files = await asyncio.to_thread(collect_files, local_path)
                await asyncio.to_thread(
                    upsert_repo,
                    repo_id,
                    existing["name"],
                    existing["url"],
                    datetime.now(UTC).isoformat(),
                    len(all_files),
                    sync_result.new_commit,
                    existing.get("branch"),
                )

                await queue.put(
                    {
                        "type": "done",
                        "repo_id": repo_id,
                        "changed_count": files_reindexed,
                        "deleted_count": len(sync_result.deleted_files),
                        "status": "synced",
                    }
                )
            except Exception as exc:
                await queue.put({"type": "error", "message": str(exc)})

        task = asyncio.create_task(run())

        try:
            while True:
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"
                if event["type"] in ("done", "error"):
                    break
        finally:
            if not task.done():
                task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/repos/{repo_id}/chats", response_model=list[ChatInfo])
async def list_repo_chats(repo_id: str):
    chats = await asyncio.to_thread(list_chats, repo_id)
    return [ChatInfo(**c) for c in chats]


@router.post("/repos/{repo_id}/chats", response_model=ChatInfo)
async def create_repo_chat(repo_id: str, body: CreateChatRequest | None = None):
    existing = await asyncio.to_thread(get_repo, repo_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Repo '{repo_id}' not indexed.")
    if body is None:
        body = CreateChatRequest()
    chat = await asyncio.to_thread(create_chat, repo_id, body.title)
    return ChatInfo(**chat)


@router.get("/repos/{repo_id}/files", response_model=list[str])
async def list_repo_files(repo_id: str):
    existing = await asyncio.to_thread(get_repo, repo_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Repo '{repo_id}' not found.")
    repo_root = str(Path(get_settings().repos_dir) / existing["name"]) + "/"
    abs_paths = await asyncio.to_thread(list_file_paths, repo_id)
    return sorted(p.removeprefix(repo_root) for p in abs_paths)


@router.get("/repos/{repo_id}/search", response_model=SearchResponse)
async def search_repo(
    repo_id: str,
    query: str = Query(..., min_length=1, max_length=2000),
    top_k: int = Query(default=10, ge=1, le=50),
):
    existing = await asyncio.to_thread(get_repo, repo_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Repo '{repo_id}' not indexed.")
    chunks = await asyncio.to_thread(hybrid_retrieve, repo_id, query, top_k)
    return SearchResponse(
        repo_id=repo_id,
        query=query,
        results=[SearchResultItem(**c) for c in chunks],
    )


@router.get("/repos/{repo_id}/navigate", response_model=NavigateResponse)
async def navigate_repo(
    repo_id: str,
    query: str = Query(default="", min_length=0, max_length=2000),
    kind: str | None = Query(default=None, pattern="^(function|class|method)$"),
    limit: int = Query(default=50, ge=1, le=200),
):
    existing = await asyncio.to_thread(get_repo, repo_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Repo '{repo_id}' not indexed.")

    if query.strip():
        rows = await asyncio.to_thread(search_symbols, repo_id, query.strip(), kind, limit)
    else:
        rows = await asyncio.to_thread(list_symbols, repo_id, kind, limit)

    return NavigateResponse(
        repo_id=repo_id,
        query=query,
        kind=kind,
        results=[SymbolItem(**r) for r in rows],
    )


@router.get("/repos/{repo_id}/health", response_model=HealthSummaryResponse)
async def get_health_summary(repo_id: str):
    existing = await asyncio.to_thread(get_repo, repo_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Repo '{repo_id}' not found.")

    from backend.core.health_analyzer import generate_health_summary

    repo_root = Path(get_settings().repos_dir) / existing["name"]
    summary = await asyncio.to_thread(generate_health_summary, repo_id, repo_root)

    return HealthSummaryResponse(
        repo_id=summary["repo_id"],
        todos=[TodoItem(**t) for t in summary["todos"]],
        complexity_hotspots=[ComplexityHotspot(**h) for h in summary["complexity_hotspots"]],
        test_coverage=TestCoverageEstimate(**summary["test_coverage"]),
        generated_at=summary["generated_at"],
    )


@router.get("/repos/{repo_id}/deps", response_model=DepGraphResponse)
async def get_dep_graph(repo_id: str):
    existing = await asyncio.to_thread(get_repo, repo_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Repo '{repo_id}' not found.")

    from backend.core.dep_extractor import extract_dep_edges, walk_source_files

    repo_root = Path(get_settings().repos_dir) / existing["name"]
    if not repo_root.exists():
        raise HTTPException(status_code=404, detail="Repo source directory not found on disk.")

    file_paths = await asyncio.to_thread(walk_source_files, repo_root)
    raw_edges = await asyncio.to_thread(extract_dep_edges, file_paths, repo_root)

    referenced = {p for edge in raw_edges for p in edge}
    nodes = [
        DepNode(
            id=p,
            label=p.rsplit("/", 1)[-1],
            ext=("." + p.rsplit(".", 1)[-1]) if "." in p.rsplit("/", 1)[-1] else "",
        )
        for p in sorted(referenced)
    ]
    edges = [DepEdge(source=s, target=t) for s, t in raw_edges]

    return DepGraphResponse(repo_id=repo_id, nodes=nodes, edges=edges)
