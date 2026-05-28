import uuid
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Chat(SQLModel, table=True):
    __tablename__ = "chats"

    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:16], primary_key=True)
    repo_id: str = Field(index=True)
    title: str = Field(default="New Chat")
    created_at: str = Field(default_factory=_now)
    updated_at: str = Field(default_factory=_now)
