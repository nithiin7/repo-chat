import json
from datetime import datetime, timezone

from sqlmodel import Session, select

from backend.persistence.chat import _touch_chat
from backend.persistence.engine import _get_engine
from backend.tables import Chat, Message


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
            chat.updated_at = datetime.now(timezone.utc).isoformat()
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
