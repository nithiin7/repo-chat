"""
Fetch and parse diffs from GitHub PRs, GitHub commits, Bitbucket PRs, or local commits.

Supports:
  - https://github.com/owner/repo/pull/123
  - https://github.com/owner/repo/commit/<sha>
  - https://bitbucket.org/workspace/repo/pull-requests/123
  - Raw commit SHA (requires repo_local_path)
"""

import re
from typing import TypedDict

import httpx
from github import Github, GithubException

_GITHUB_PR_RE = re.compile(
    r'github\.com/([^/]+)/([^/]+)/pull/(\d+)', re.IGNORECASE
)
_GITHUB_COMMIT_RE = re.compile(
    r'github\.com/([^/]+)/([^/]+)/commit/([0-9a-f]{7,40})', re.IGNORECASE
)
_BITBUCKET_PR_RE = re.compile(
    r'bitbucket\.org/([^/]+)/([^/]+)/pull-requests/(\d+)', re.IGNORECASE
)
_COMMIT_SHA_RE = re.compile(r'^[0-9a-f]{7,40}$', re.IGNORECASE)

_MAX_PATCH_LINES = 150
_MAX_FILES = 40


class DiffFile(TypedDict):
    file_path: str
    old_path: str | None
    change_type: str  # "added" | "modified" | "deleted" | "renamed"
    patch: str
    additions: int
    deletions: int


class DiffResult(TypedDict):
    source_type: str
    title: str
    files: list[DiffFile]
    additions: int
    deletions: int


def _truncate_patch(patch: str) -> str:
    if not patch:
        return ""
    lines = patch.splitlines()
    if len(lines) > _MAX_PATCH_LINES:
        kept = lines[:_MAX_PATCH_LINES]
        kept.append(f"[… {len(lines) - _MAX_PATCH_LINES} more lines truncated]")
        return "\n".join(kept)
    return patch


async def fetch_diff(
    source_url: str,
    github_token: str | None,
    repo_local_path: str | None,
) -> DiffResult:
    m = _GITHUB_PR_RE.search(source_url)
    if m:
        return await _fetch_github_pr(m.group(1), m.group(2), int(m.group(3)), github_token)

    m = _GITHUB_COMMIT_RE.search(source_url)
    if m:
        return await _fetch_github_commit(m.group(1), m.group(2), m.group(3), github_token)

    m = _BITBUCKET_PR_RE.search(source_url)
    if m:
        return await _fetch_bitbucket_pr(m.group(1), m.group(2), int(m.group(3)))

    if _COMMIT_SHA_RE.match(source_url.strip()) and repo_local_path:
        return _fetch_local_commit(source_url.strip(), repo_local_path)

    raise ValueError(
        f"Unrecognised URL or SHA: {source_url!r}. "
        "Expected a GitHub PR/commit URL, a Bitbucket PR URL, or a raw commit SHA."
    )


# ---------------------------------------------------------------------------
# GitHub PR
# ---------------------------------------------------------------------------

async def _fetch_github_pr(
    owner: str, repo: str, pr_number: int, token: str | None
) -> DiffResult:
    try:
        g = Github(token or None)
        gh_repo = g.get_repo(f"{owner}/{repo}")
        pr = gh_repo.get_pull(pr_number)
    except GithubException as exc:
        raise RuntimeError(f"GitHub API error: {exc.data.get('message', exc)}") from exc

    files: list[DiffFile] = []
    total_add = total_del = 0

    for f in list(pr.get_files())[:_MAX_FILES]:
        ct = _map_github_status(f.status)
        patch = _truncate_patch(f.patch or "")
        files.append(DiffFile(
            file_path=f.filename,
            old_path=f.previous_filename if f.status == "renamed" else None,
            change_type=ct,
            patch=patch,
            additions=f.additions,
            deletions=f.deletions,
        ))
        total_add += f.additions
        total_del += f.deletions

    return DiffResult(
        source_type="github_pr",
        title=f"PR #{pr_number}: {pr.title}",
        files=files,
        additions=total_add,
        deletions=total_del,
    )


# ---------------------------------------------------------------------------
# GitHub commit
# ---------------------------------------------------------------------------

async def _fetch_github_commit(
    owner: str, repo: str, sha: str, token: str | None
) -> DiffResult:
    try:
        g = Github(token or None)
        gh_repo = g.get_repo(f"{owner}/{repo}")
        commit = gh_repo.get_commit(sha)
    except GithubException as exc:
        raise RuntimeError(f"GitHub API error: {exc.data.get('message', exc)}") from exc

    files: list[DiffFile] = []
    total_add = total_del = 0

    for f in list(commit.files)[:_MAX_FILES]:
        ct = _map_github_status(f.status)
        patch = _truncate_patch(f.patch or "")
        files.append(DiffFile(
            file_path=f.filename,
            old_path=f.previous_filename if f.status == "renamed" else None,
            change_type=ct,
            patch=patch,
            additions=f.additions,
            deletions=f.deletions,
        ))
        total_add += f.additions
        total_del += f.deletions

    msg = commit.commit.message.splitlines()[0][:80]
    return DiffResult(
        source_type="github_commit",
        title=f"Commit {sha[:8]}: {msg}",
        files=files,
        additions=total_add,
        deletions=total_del,
    )


# ---------------------------------------------------------------------------
# Bitbucket PR  (public repos only — no auth yet)
# ---------------------------------------------------------------------------

async def _fetch_bitbucket_pr(
    workspace: str, repo: str, pr_number: int
) -> DiffResult:
    base = f"https://api.bitbucket.org/2.0/repositories/{workspace}/{repo}"
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        meta = (await client.get(f"{base}/pullrequests/{pr_number}")).raise_for_status().json()
        diff_text = (await client.get(f"{base}/pullrequests/{pr_number}/diff")).raise_for_status().text

    files = _parse_unified_diff(diff_text)
    total_add = sum(f["additions"] for f in files)
    total_del = sum(f["deletions"] for f in files)

    return DiffResult(
        source_type="bitbucket_pr",
        title=f"PR #{pr_number}: {meta.get('title', 'Untitled')}",
        files=files,
        additions=total_add,
        deletions=total_del,
    )


# ---------------------------------------------------------------------------
# Local commit (gitpython)
# ---------------------------------------------------------------------------

def _fetch_local_commit(sha: str, repo_path: str) -> DiffResult:
    import git  # type: ignore[import]

    repo = git.Repo(repo_path)
    try:
        commit = repo.commit(sha)
    except Exception as exc:
        raise RuntimeError(f"Commit {sha!r} not found in local repo: {exc}") from exc

    parent = commit.parents[0] if commit.parents else None
    raw_diffs = parent.diff(commit) if parent else commit.diff(None)

    files: list[DiffFile] = []
    total_add = total_del = 0

    for d in list(raw_diffs)[:_MAX_FILES]:
        try:
            raw = d.diff.decode("utf-8", errors="replace") if d.diff else ""
        except Exception:
            raw = ""
        patch = _truncate_patch(raw)
        add = sum(1 for ln in patch.splitlines() if ln.startswith("+") and not ln.startswith("+++"))
        delete = sum(1 for ln in patch.splitlines() if ln.startswith("-") and not ln.startswith("---"))

        files.append(DiffFile(
            file_path=d.b_path or d.a_path or "",
            old_path=d.a_path if d.renamed_file else None,
            change_type=(
                "renamed" if d.renamed_file
                else "added" if d.new_file
                else "deleted" if d.deleted_file
                else "modified"
            ),
            patch=patch,
            additions=add,
            deletions=delete,
        ))
        total_add += add
        total_del += delete

    msg = commit.message.splitlines()[0][:80]
    return DiffResult(
        source_type="commit",
        title=f"Commit {sha[:8]}: {msg}",
        files=files,
        additions=total_add,
        deletions=total_del,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _map_github_status(status: str) -> str:
    return {
        "added": "added",
        "removed": "deleted",
        "modified": "modified",
        "renamed": "renamed",
        "copied": "modified",
        "changed": "modified",
        "unchanged": "modified",
    }.get(status, "modified")


def _parse_unified_diff(diff_text: str) -> list[DiffFile]:
    """Minimal parser for a unified diff string → list[DiffFile]."""
    files: list[DiffFile] = []
    current_path: str | None = None
    patch_lines: list[str] = []
    add = del_ = 0

    def _flush() -> None:
        nonlocal add, del_
        if current_path is None:
            return
        files.append(DiffFile(
            file_path=current_path,
            old_path=None,
            change_type="modified",
            patch=_truncate_patch("\n".join(patch_lines)),
            additions=add,
            deletions=del_,
        ))

    for line in diff_text.splitlines():
        if line.startswith("diff --git "):
            _flush()
            current_path = None
            patch_lines = []
            add = del_ = 0
        elif line.startswith("+++ b/"):
            current_path = line[6:]
        elif current_path:
            patch_lines.append(line)
            if line.startswith("+") and not line.startswith("+++"):
                add += 1
            elif line.startswith("-") and not line.startswith("---"):
                del_ += 1

    _flush()
    return files[:_MAX_FILES]


# ---------------------------------------------------------------------------
# Format diff for LLM prompt injection
# ---------------------------------------------------------------------------

def format_diff_for_prompt(diff: dict) -> str:
    """Render a stored diff dict as a text block suitable for an LLM prompt."""
    lines = [
        f"=== PR / Diff Analysis ===",
        f"Title    : {diff['title']}",
        f"Changes  : +{diff['additions']} additions, -{diff['deletions']} deletions across {diff['files_changed']} file(s)",
    ]
    if diff.get("source_url"):
        lines.append(f"Source   : {diff['source_url']}")
    lines.append("")

    for f in diff["diff_data"]:
        header = f"--- {f['file_path']} [{f['change_type'].upper()}  +{f['additions']}/-{f['deletions']}] ---"
        lines.append(header)
        if f["patch"]:
            lines.append(f["patch"])
        lines.append("")

    lines.append("=== End Diff ===")
    return "\n".join(lines)
