from sqlmodel import Field, Index, SQLModel


class ParentChunk(SQLModel, table=True):
    __tablename__ = "parent_chunks"
    __table_args__ = (Index("ix_parent_chunks_repo", "repo_id"),)

    id: str = Field(primary_key=True)  # UUID
    repo_id: str = Field(index=True)
    file_path: str
    text: str
    chunk_index: int
    language: str
    chunk_type: str = "module"  # function | class | method | module
    symbol_name: str | None = None
