from typing import Optional

from sqlmodel import Field, SQLModel


class Repo(SQLModel, table=True):
    __tablename__ = "repos"

    repo_id: str = Field(primary_key=True)
    name: str
    url: str = Field(unique=True)
    indexed_at: str
    file_count: int
    last_indexed_commit: Optional[str] = None
    branch: Optional[str] = None
