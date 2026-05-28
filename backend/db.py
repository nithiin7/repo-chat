"""
SQLite persistence layer for chats and messages.

Tables:
    chats    — one row per conversation session, belongs to a repo
    messages — one row per turn (user or assistant), belongs to a chat
"""

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from backend.config import get_settings


def _db_path() -> Path:
    return Path(get_settings().repos_dir) / "codelens.db"


def _connect() -> sqlite3.Connection:
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    """Create tables if they don't exist. Call once at app startup."""
    with _connect() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS chats (
                id         TEXT PRIMARY KEY,
                repo_id    TEXT NOT NULL,
                title      TEXT NOT NULL DEFAULT 'New Chat',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_chats_repo ON chats(repo_id);

            CREATE TABLE IF NOT EXISTS messages (
                id         TEXT PRIMARY KEY,
                chat_id    TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
                role       TEXT NOT NULL,
                content    TEXT NOT NULL,
                sources    TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
        """)


# ---------------------------------------------------------------------------
# Chat CRUD
# ---------------------------------------------------------------------------

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_chat(repo_id: str, title: str = "New Chat") -> dict:
    chat_id = uuid.uuid4().hex[:16]
    now = _now()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO chats (id, repo_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (chat_id, repo_id, title, now, now),
        )
    return {"id": chat_id, "repo_id": repo_id, "title": title, "created_at": now, "updated_at": now}


def list_chats(repo_id: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM chats WHERE repo_id = ? ORDER BY updated_at DESC",
            (repo_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def get_chat(chat_id: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM chats WHERE id = ?", (chat_id,)).fetchone()
    return dict(row) if row else None


def rename_chat(chat_id: str, title: str) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE chats SET title = ?, updated_at = ? WHERE id = ?",
            (title, _now(), chat_id),
        )


def delete_chat(chat_id: str) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM chats WHERE id = ?", (chat_id,))


def delete_chats_for_repo(repo_id: str) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM chats WHERE repo_id = ?", (repo_id,))


def _touch_chat(chat_id: str, conn: sqlite3.Connection) -> None:
    conn.execute("UPDATE chats SET updated_at = ? WHERE id = ?", (_now(), chat_id))


# ---------------------------------------------------------------------------
# Message CRUD
# ---------------------------------------------------------------------------

def save_message(
    chat_id: str,
    role: str,
    content: str,
    sources: list | None = None,
) -> str:
    msg_id = uuid.uuid4().hex[:16]
    now = _now()
    sources_json = json.dumps(sources) if sources is not None else None
    with _connect() as conn:
        conn.execute(
            "INSERT INTO messages (id, chat_id, role, content, sources, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (msg_id, chat_id, role, content, sources_json, now),
        )
        _touch_chat(chat_id, conn)
    return msg_id


def set_chat_title_if_default(chat_id: str, title: str) -> None:
    """Update the chat title only if it is still the default 'New Chat'."""
    truncated = title[:60].rstrip()
    with _connect() as conn:
        conn.execute(
            "UPDATE chats SET title = ?, updated_at = ? WHERE id = ? AND title = 'New Chat'",
            (truncated, _now(), chat_id),
        )


def list_messages(chat_id: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC",
            (chat_id,),
        ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["sources"] = json.loads(d["sources"]) if d["sources"] else None
        result.append(d)
    return result
