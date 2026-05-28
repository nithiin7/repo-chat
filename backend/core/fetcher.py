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
        cloned = git.Repo.clone_from(clone_url, str(dest), depth=1, no_single_branch=True)
        head_sha = cloned.head.commit.hexsha
    except GitCommandError as exc:
        # Clean up the empty dest so a retry starts fresh.
        shutil.rmtree(dest, ignore_errors=True)

        stderr = str(exc).lower()

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

def fetch_github_repo(owner: str, repo_name: str, dest: Path) -> FetchResult:
    """Clone a GitHub repository, injecting GITHUB_TOKEN when available."""
    token = get_settings().github_token
    display_url = f"https://github.com/{owner}/{repo_name}"

    if token:
        clone_url = f"https://{token}@github.com/{owner}/{repo_name}.git"
    else:
        clone_url = f"https://github.com/{owner}/{repo_name}.git"

    return _clone(
        clone_url,
        dest,
        display_url=display_url,
        provider="github",
        owner=owner,
        repo_name=repo_name,
    )


def fetch_bitbucket_repo(owner: str, repo_name: str, dest: Path) -> FetchResult:
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
    )


# ----- public entry point ---------------------------------------------------

def fetch_repo(repo_url: str) -> FetchResult:
    """
    Parse repo_url, clone the repository to <repos_dir>/<repo-name> at depth 1,
    and return a FetchResult containing:
        - local_path  : the directory the repo was cloned into
        - file_paths  : sorted list of every indexable source file

    Raises RepoFetchError for any URL, network, or authentication problem.
    """
    parsed = parse_repo_url(repo_url)
    provider: str = parsed["provider"]
    owner: str = parsed["owner"]
    repo_name: str = parsed["repo_name"]

    repos_dir = Path(get_settings().repos_dir)
    repos_dir.mkdir(parents=True, exist_ok=True)
    dest = repos_dir / repo_name

    if provider == "github":
        return fetch_github_repo(owner, repo_name, dest)
    return fetch_bitbucket_repo(owner, repo_name, dest)


# ----- remote HEAD commit check ---------------------------------------------

def get_remote_head(repo_url: str) -> str | None:
    """
    Return the current HEAD commit SHA of the remote repo without cloning.
    Uses `git ls-remote` with the same auth-injected URL used for cloning.
    Returns None if the check fails for any reason.
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

    try:
        output = git.cmd.Git().execute(
            ["git", "ls-remote", clone_url, "HEAD"],
            with_extended_output=False,
        )
        if output:
            sha = output.split()[0]
            if len(sha) == 40:
                return sha
    except Exception:
        pass
    return None
