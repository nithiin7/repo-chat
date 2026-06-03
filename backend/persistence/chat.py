from datetime import UTC, datetime

from backend.persistence.engine import _get_engine
from backend.tables import Chat
from sqlmodel import Session, select


def _now() -> str:
    return datetime.now(UTC).isoformat()


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


def fork_chat(source_chat_id: str, before_message_id: str | None) -> dict | None:
    """Create a new chat copying messages from source_chat_id up to (not including) before_message_id."""
    from backend.tables import Message
    from sqlmodel import select

    with Session(_get_engine()) as session:
        source = session.get(Chat, source_chat_id)
        if not source:
            return None

        new_chat = Chat(repo_id=source.repo_id, title=f"Fork of {source.title}")
        session.add(new_chat)
        session.flush()

        all_messages = session.exec(
            select(Message)
            .where(Message.chat_id == source_chat_id)
            .order_by(Message.created_at.asc())
        ).all()

        to_copy = all_messages
        if before_message_id:
            pivot = next((m for m in all_messages if m.id == before_message_id), None)
            if pivot:
                to_copy = [m for m in all_messages if m.created_at < pivot.created_at]
            else:
                to_copy = []

        for m in to_copy:
            session.add(
                Message(
                    chat_id=new_chat.id,
                    role=m.role,
                    content=m.content,
                    sources=m.sources,
                    created_at=m.created_at,
                )
            )

        session.commit()
        session.refresh(new_chat)
    return new_chat.model_dump()


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
