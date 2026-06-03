from typing import Optional

from sqlmodel import Field, SQLModel


class Diff(SQLModel, table=True):
    id: str = Field(primary_key=True)
    repo_id: str = Field(index=True)
    source_url: Optional[str] = None
    source_type: str  # "github_pr" | "github_commit" | "bitbucket_pr" | "commit"
    title: str
    files_changed: int = 0
    additions: int = 0
    deletions: int = 0
    diff_data: str  # JSON-encoded list[DiffFile]
    indexed_at: str
