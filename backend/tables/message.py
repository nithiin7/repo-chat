import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, ForeignKey, String
from sqlmodel import Field, SQLModel


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Message(SQLModel, table=True):
    __tablename__ = "messages"

    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:16], primary_key=True)
    chat_id: str = Field(
        sa_column=Column(String, ForeignKey("chats.id", ondelete="CASCADE"), index=True, nullable=False)
    )
    role: str
    content: str
    sources: Optional[str] = None
    created_at: str = Field(default_factory=_now)
