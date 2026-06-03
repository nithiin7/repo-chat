import asyncio
import os

from fastapi import APIRouter, HTTPException

from backend.config import get_settings
from backend.core.diff_fetcher import fetch_diff
from backend.persistence import get_repo
from backend.persistence.diff import delete_diff, get_diff, list_diffs, save_diff
from backend.schemas import DiffIndexRequest, DiffIndexResponse, DiffInfo

router = APIRouter()


@router.post("/repos/{repo_id}/diffs", response_model=DiffIndexResponse)
async def index_diff(repo_id: str, body: DiffIndexRequest):
    repo = await asyncio.to_thread(get_repo, repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail=f"Repo '{repo_id}' not indexed. Call POST /index first.")

    settings = get_settings()
    repo_local_path = os.path.join(settings.repos_dir, repo["name"])
    if not os.path.isdir(repo_local_path):
        repo_local_path = None

    try:
        result = await fetch_diff(body.source_url, body.github_token, repo_local_path)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch diff: {exc}") from exc

    diff = await asyncio.to_thread(
        save_diff,
        repo_id=repo_id,
        source_url=body.source_url,
        source_type=result["source_type"],
        title=result["title"],
        files_changed=len(result["files"]),
        additions=result["additions"],
        deletions=result["deletions"],
        diff_data=result["files"],
    )

    return DiffIndexResponse(
        diff_id=diff.id,
        title=diff.title,
        files_changed=diff.files_changed,
        additions=diff.additions,
        deletions=diff.deletions,
    )


@router.get("/repos/{repo_id}/diffs", response_model=list[DiffInfo])
async def get_diffs_for_repo(repo_id: str):
    repo = await asyncio.to_thread(get_repo, repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail=f"Repo '{repo_id}' not indexed.")
    diffs = await asyncio.to_thread(list_diffs, repo_id)
    return [DiffInfo(**d) for d in diffs]


@router.get("/diffs/{diff_id}", response_model=DiffInfo)
async def get_diff_endpoint(diff_id: str):
    diff = await asyncio.to_thread(get_diff, diff_id)
    if not diff:
        raise HTTPException(status_code=404, detail=f"Diff '{diff_id}' not found.")
    # Exclude diff_data from the response (it can be large)
    return DiffInfo(**{k: v for k, v in diff.items() if k != "diff_data"})


@router.delete("/diffs/{diff_id}")
async def remove_diff(diff_id: str):
    deleted = await asyncio.to_thread(delete_diff, diff_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Diff '{diff_id}' not found.")
    return {"status": "deleted", "diff_id": diff_id}
