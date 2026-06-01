from datetime import datetime, timezone

from sqlmodel import Session, select

from backend.persistence.engine import _get_engine
from backend.tables import Chat


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


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
            select(Chat)
            .where(Chat.repo_id == repo_id)
            .order_by(Chat.is_pinned.desc(), Chat.updated_at.desc())
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


def pin_chat(chat_id: str, is_pinned: bool) -> None:
    with Session(_get_engine()) as session:
        chat = session.get(Chat, chat_id)
        if chat:
            chat.is_pinned = is_pinned
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
