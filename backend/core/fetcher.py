"""
Repository fetcher — parses a GitHub or Bitbucket HTTPS URL, clones the repo
to ./repos/<repo-name> using gitpython, and returns the local path plus a
list of every indexable source file found inside it.
"""

import shutil
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

import git
from git import GitCommandError

from backend.config import get_settings

# ----- constants ------------------------------------------------------------

INDEXABLE_EXTENSIONS: frozenset[str] = frozenset(
    {".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".go"}
)

# Directories that are never worth indexing — skipped during the file walk.
_SKIP_DIRS: frozenset[str] = frozenset(
    {
        ".git",
        "node_modules",
        "__pycache__",
        ".venv",
        "venv",
        "env",
        "dist",
        "build",
        ".next",
        "out",
        "vendor",
        ".idea",
        ".vscode",
    }
)


# ----- result type ----------------------------------------------------------

@dataclass
class FetchResult:
    local_path: Path
    file_paths: list[Path] = field(default_factory=list)
    head_commit: str = ""

    @property
    def repo_name(self) -> str:
        return self.local_path.name


@dataclass
class SyncResult:
    local_path: Path
    old_commit: str
    new_commit: str
    changed_files: list[Path] = field(default_factory=list)
    deleted_files: list[str] = field(default_factory=list)


# ----- errors ---------------------------------------------------------------

class RepoFetchError(Exception):
    """Raised when a repo cannot be fetched (bad URL, private, network, etc.)."""


# ----- URL parsing ----------------------------------------------------------

def parse_repo_url(repo_url: str) -> dict[str, str]:
    """
    Extract provider, owner, and repo name from a GitHub or Bitbucket HTTPS URL.

    Accepts:
        https://github.com/owner/repo
        https://github.com/owner/repo.git
        https://bitbucket.org/workspace/repo
        https://bitbucket.org/workspace/repo.git
    """
    parsed = urlparse(repo_url.strip().rstrip("/"))
    host = (parsed.hostname or "").lower()

    if "github.com" in host:
        provider = "github"
    elif "bitbucket.org" in host:
        provider = "bitbucket"
    else:
        raise RepoFetchError(
            f"Unsupported host '{host}'. "
            "Only github.com and bitbucket.org are supported."
        )

    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) < 2:
        raise RepoFetchError(
            f"Cannot parse owner/repo from URL '{repo_url}'. "
            "Expected format: https://github.com/<owner>/<repo>"
        )

    owner = parts[0]
    repo_name = parts[1].removesuffix(".git")

    return {"provider": provider, "owner": owner, "repo_name": repo_name}


# ----- file collection ------------------------------------------------------

def collect_files(root: Path) -> list[Path]:
    """
    Walk root recursively and return all files whose extension is in
    INDEXABLE_EXTENSIONS, skipping any path that passes through a _SKIP_DIRS
    directory.  Results are sorted for deterministic ordering.
    """
    files: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix not in INDEXABLE_EXTENSIONS:
            continue
        # Check every directory component relative to root.
        relative_parts = path.relative_to(root).parts
        if any(part in _SKIP_DIRS for part in relative_parts):
            continue
        files.append(path)
    return sorted(files)


# ----- clone helpers --------------------------------------------------------

def _clone(
    clone_url: str,
    dest: Path,
    *,
    display_url: str,
    provider: str,
    owner: str,
    repo_name: str,
    branch: str | None = None,
) -> FetchResult:
    """
    Run git clone --depth 1 into dest.  Any existing dest is wiped first so
    re-indexing the same repo always starts from a clean state.

    Translates common GitCommandError messages into readable RepoFetchErrors.
    The clone_url may contain credentials; display_url is the sanitised form
    logged in error messages.
    """
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True, exist_ok=True)

    try:
        kwargs: dict = {"depth": 1}
        if branch:
            kwargs["branch"] = branch
        else:
            kwargs["no_single_branch"] = True
        cloned = git.Repo.clone_from(clone_url, str(dest), **kwargs)
        head_sha = cloned.head.commit.hexsha
    except GitCommandError as exc:
        # Clean up the empty dest so a retry starts fresh.
        shutil.rmtree(dest, ignore_errors=True)

        stderr = str(exc).lower()

        if branch and "remote branch" in stderr and "not found" in stderr:
            raise RepoFetchError(
                f"Branch '{branch}' was not found in '{owner}/{repo_name}'."
            ) from exc

        if any(kw in stderr for kw in ("repository not found", "not found", "does not exist")):
            raise RepoFetchError(
                f"Repository '{owner}/{repo_name}' was not found on {provider}. "
                "Verify the URL is correct and the repo is public, or supply "
                "credentials for a private repo."
            ) from exc

        if any(kw in stderr for kw in ("authentication", "403", "401", "access denied")):
            cred_hint = (
                "GITHUB_TOKEN" if provider == "github"
                else "BITBUCKET_USERNAME / BITBUCKET_APP_PASSWORD"
            )
            raise RepoFetchError(
                f"Authentication failed for '{owner}/{repo_name}'. "
                f"Set {cred_hint} in your .env file."
            ) from exc

        if "could not resolve host" in stderr:
            raise RepoFetchError(
                f"Cannot reach {display_url}. Check your network connection."
            ) from exc

        raise RepoFetchError(f"Git clone failed for '{display_url}': {exc}") from exc

    files = collect_files(dest)
    return FetchResult(local_path=dest, file_paths=files, head_commit=head_sha)


# ----- provider-specific fetchers -------------------------------------------

def fetch_github_repo(
    owner: str,
    repo_name: str,
    dest: Path,
    *,
    token: str | None = None,
    branch: str | None = None,
) -> FetchResult:
    """Clone a GitHub repository, injecting a token when available.

    token takes precedence over the GITHUB_TOKEN env var.
    """
    resolved_token = token or get_settings().github_token
    display_url = f"https://github.com/{owner}/{repo_name}"

    if resolved_token:
        clone_url = f"https://{resolved_token}@github.com/{owner}/{repo_name}.git"
    else:
        clone_url = f"https://github.com/{owner}/{repo_name}.git"

    return _clone(
        clone_url,
        dest,
        display_url=display_url,
        provider="github",
        owner=owner,
        repo_name=repo_name,
        branch=branch,
    )


def fetch_bitbucket_repo(
    owner: str,
    repo_name: str,
    dest: Path,
    *,
    branch: str | None = None,
) -> FetchResult:
    """Clone a Bitbucket repository using an app password when available."""
    settings = get_settings()
    username = settings.bitbucket_username
    app_password = settings.bitbucket_app_password
    display_url = f"https://bitbucket.org/{owner}/{repo_name}"

    if username and app_password:
        clone_url = (
            f"https://{username}:{app_password}"
            f"@bitbucket.org/{owner}/{repo_name}.git"
        )
    else:
        clone_url = f"https://bitbucket.org/{owner}/{repo_name}.git"

    return _clone(
        clone_url,
        dest,
        display_url=display_url,
        provider="bitbucket",
        owner=owner,
        repo_name=repo_name,
        branch=branch,
    )


# ----- public entry point ---------------------------------------------------

def fetch_repo(
    repo_url: str,
    *,
    github_token: str | None = None,
    branch: str | None = None,
) -> FetchResult:
    """
    Parse repo_url, clone the repository to <repos_dir>/<repo-name> at depth 1,
    and return a FetchResult containing:
        - local_path  : the directory the repo was cloned into
        - file_paths  : sorted list of every indexable source file

    Raises RepoFetchError for any URL, network, or authentication problem.
    github_token overrides the GITHUB_TOKEN env var for this call only.
    branch pins the clone to a specific branch; defaults to the remote HEAD.
    """
    parsed = parse_repo_url(repo_url)
    provider: str = parsed["provider"]
    owner: str = parsed["owner"]
    repo_name: str = parsed["repo_name"]

    repos_dir = Path(get_settings().repos_dir)
    repos_dir.mkdir(parents=True, exist_ok=True)
    dest = repos_dir / repo_name

    if provider == "github":
        return fetch_github_repo(owner, repo_name, dest, token=github_token, branch=branch)
    return fetch_bitbucket_repo(owner, repo_name, dest, branch=branch)


# ----- incremental sync (pull) ----------------------------------------------

def pull_repo(
    local_path: Path,
    *,
    branch: str | None = None,
) -> SyncResult:
    """
    Update an existing shallow clone via git fetch + reset --hard FETCH_HEAD.
    Returns a SyncResult with lists of indexable changed and deleted file paths.
    Raises RepoFetchError if the local repo is missing or the fetch fails.
    """
    if not local_path.exists():
        raise RepoFetchError(
            f"Local repo not found at '{local_path}'. Re-index the repository first."
        )

    try:
        repo = git.Repo(str(local_path))
    except git.InvalidGitRepositoryError as exc:
        raise RepoFetchError(f"'{local_path}' is not a valid git repository.") from exc

    old_sha = repo.head.commit.hexsha

    try:
        if branch:
            repo.remotes.origin.fetch(branch, depth=1)
        else:
            repo.remotes.origin.fetch(depth=1)
    except GitCommandError as exc:
        raise RepoFetchError(f"Git fetch failed: {exc}") from exc

    # Diff before resetting the working tree
    try:
        deleted_out = repo.git.diff("HEAD", "FETCH_HEAD", "--name-only", "--diff-filter=D")
        changed_out = repo.git.diff("HEAD", "FETCH_HEAD", "--name-only", "--diff-filter=ACMR")
    except GitCommandError:
        deleted_out = ""
        changed_out = ""

    repo.git.reset("--hard", "FETCH_HEAD")
    new_sha = repo.head.commit.hexsha

    if old_sha == new_sha:
        return SyncResult(
            local_path=local_path,
            old_commit=old_sha,
            new_commit=new_sha,
        )

    deleted_files: list[str] = []
    for rel in deleted_out.splitlines():
        rel = rel.strip()
        if rel and Path(rel).suffix in INDEXABLE_EXTENSIONS:
            deleted_files.append(str(local_path / rel))

    changed_files: list[Path] = []
    for rel in changed_out.splitlines():
        rel = rel.strip()
        if not rel:
            continue
        abs_path = local_path / rel
        if abs_path.suffix not in INDEXABLE_EXTENSIONS or not abs_path.is_file():
            continue
        if any(part in _SKIP_DIRS for part in abs_path.relative_to(local_path).parts):
            continue
        changed_files.append(abs_path)

    return SyncResult(
        local_path=local_path,
        old_commit=old_sha,
        new_commit=new_sha,
        changed_files=sorted(changed_files),
        deleted_files=sorted(deleted_files),
    )


# ----- remote HEAD commit check ---------------------------------------------

def get_remote_head(repo_url: str, branch: str | None = None) -> str | None:
    """
    Return the current HEAD commit SHA of the remote repo (or a specific branch)
    without cloning. Uses `git ls-remote`. Returns None if the check fails.
    """
    try:
        parsed = parse_repo_url(repo_url)
    except RepoFetchError:
        return None

    provider = parsed["provider"]
    owner = parsed["owner"]
    repo_name = parsed["repo_name"]
    settings = get_settings()

    if provider == "github":
        token = settings.github_token
        if token:
            clone_url = f"https://{token}@github.com/{owner}/{repo_name}.git"
        else:
            clone_url = f"https://github.com/{owner}/{repo_name}.git"
    else:
        username = settings.bitbucket_username
        app_password = settings.bitbucket_app_password
        if username and app_password:
            clone_url = (
                f"https://{username}:{app_password}"
                f"@bitbucket.org/{owner}/{repo_name}.git"
            )
        else:
            clone_url = f"https://bitbucket.org/{owner}/{repo_name}.git"

    ref = f"refs/heads/{branch}" if branch else "HEAD"

    try:
        output = git.cmd.Git().execute(
            ["git", "ls-remote", clone_url, ref],
            with_extended_output=False,
        )
        if output:
            sha = output.split()[0]
            if len(sha) == 40:
                return sha
    except Exception:
        pass
    return None
