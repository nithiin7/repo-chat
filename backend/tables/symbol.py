from sqlmodel import Field, Index, SQLModel


class Symbol(SQLModel, table=True):
    __tablename__ = "symbols"
    __table_args__ = (
        Index("ix_symbols_repo_name", "repo_id", "name"),
    )

    id: int | None = Field(default=None, primary_key=True)
    repo_id: str = Field(index=True)
    name: str
    kind: str       # function | class | method
    file_path: str
    start_line: int
    end_line: int
    signature: str
    snippet: str
