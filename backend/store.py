"""
Metadata store — reads/writes repos.json that lives alongside the cloned repos.

All reads and writes happen inside async route handlers (the event loop),
so no locking is required.
"""

import hashlib
import json
from pathlib import Path

from backend.config import get_settings


def metadata_path() -> Path:
    return Path(get_settings().repos_dir) / "repos.json"


def read_metadata() -> dict[str, dict]:
    path = metadata_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def write_metadata(data: dict[str, dict]) -> None:
    path = metadata_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def repo_id_from_url(url: str) -> str:
    """Stable 16-char hex ID so the same URL always maps to the same repo_id."""
    return hashlib.sha256(url.lower().rstrip("/").encode()).hexdigest()[:16]
