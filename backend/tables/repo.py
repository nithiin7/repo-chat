from sqlmodel import Field, SQLModel


class Repo(SQLModel, table=True):
    __tablename__ = "repos"

    repo_id: str = Field(primary_key=True)
    name: str
    url: str = Field(unique=True)
    indexed_at: str
    file_count: int
    last_indexed_commit: str | None = None
    branch: str | None = None
