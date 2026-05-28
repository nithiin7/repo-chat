"""
SQLite persistence layer for chats and messages.

Tables:
    chats    — one row per conversation session, belongs to a repo
    messages — one row per turn (user or assistant), belongs to a chat
"""

import json
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine, select

from backend.config import get_settings
from backend.tables import Chat, Message


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


_db_engine: Engine | None = None


def _get_engine() -> Engine:
    global _db_engine
    if _db_engine is None:
        path = Path(get_settings().repos_dir) / "codelens.db"
        path.parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(
            f"sqlite:///{path}",
            connect_args={"check_same_thread": False},
        )

        @event.listens_for(engine, "connect")
        def _set_pragmas(dbapi_conn, _):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        _db_engine = engine
    return _db_engine


# ---------------------------------------------------------------------------
# Init
# ---------------------------------------------------------------------------

def init_db() -> None:
    """Create tables if they don't exist. Call once at app startup."""
    SQLModel.metadata.create_all(_get_engine())


# ---------------------------------------------------------------------------
# Chat CRUD
# ---------------------------------------------------------------------------

def create_chat(repo_id: str, title: str = "New Chat") -> dict:
    chat = Chat(repo_id=repo_id, title=title)
    with Session(_get_engine()) as session:
        session.add(chat)
        session.commit()
        session.refresh(chat)
    return chat.model_dump()


def list_chats(repo_id: str) -> list[dict]:
    with Session(_get_engine()) as session:
        chats = session.exec(
            select(Chat).where(Chat.repo_id == repo_id).order_by(Chat.updated_at.desc())
        ).all()
    return [c.model_dump() for c in chats]


def get_chat(chat_id: str) -> dict | None:
    with Session(_get_engine()) as session:
        chat = session.get(Chat, chat_id)
    return chat.model_dump() if chat else None


def rename_chat(chat_id: str, title: str) -> None:
    with Session(_get_engine()) as session:
        chat = session.get(Chat, chat_id)
        if chat:
            chat.title = title
            chat.updated_at = _now()
            session.add(chat)
            session.commit()


def delete_chat(chat_id: str) -> None:
    with Session(_get_engine()) as session:
        chat = session.get(Chat, chat_id)
        if chat:
            session.delete(chat)
            session.commit()


def delete_chats_for_repo(repo_id: str) -> None:
    with Session(_get_engine()) as session:
        chats = session.exec(select(Chat).where(Chat.repo_id == repo_id)).all()
        for chat in chats:
            session.delete(chat)
        session.commit()


def _touch_chat(chat_id: str, session: Session) -> None:
    chat = session.get(Chat, chat_id)
    if chat:
        chat.updated_at = _now()
        session.add(chat)


# ---------------------------------------------------------------------------
# Message CRUD
# ---------------------------------------------------------------------------

def save_message(
    chat_id: str,
    role: str,
    content: str,
    sources: list | None = None,
) -> str:
    sources_json = json.dumps(sources) if sources is not None else None
    msg = Message(chat_id=chat_id, role=role, content=content, sources=sources_json)
    with Session(_get_engine()) as session:
        session.add(msg)
        _touch_chat(chat_id, session)
        session.commit()
        session.refresh(msg)
    return msg.id


def set_chat_title_if_default(chat_id: str, title: str) -> None:
    """Update the chat title only if it is still the default 'New Chat'."""
    truncated = title[:60].rstrip()
    with Session(_get_engine()) as session:
        chat = session.get(Chat, chat_id)
        if chat and chat.title == "New Chat":
            chat.title = truncated
            chat.updated_at = _now()
            session.add(chat)
            session.commit()


def list_messages(chat_id: str) -> list[dict]:
    with Session(_get_engine()) as session:
        messages = session.exec(
            select(Message).where(Message.chat_id == chat_id).order_by(Message.created_at.asc())
        ).all()
    result = []
    for m in messages:
        d = m.model_dump()
        d["sources"] = json.loads(d["sources"]) if d["sources"] else None
        result.append(d)
    return result
