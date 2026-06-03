from pathlib import Path

from backend.config import get_settings
from sqlalchemy import event, exc, text
from sqlalchemy.engine import Engine
from sqlmodel import SQLModel, create_engine

_db_engine: Engine | None = None


def _get_engine() -> Engine:
    global _db_engine
    if _db_engine is None:
        path = Path(get_settings().repos_dir) / "codelens.db"
        path.parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(
            f"sqlite:///{path}",
            connect_args={"check_same_thread": False},
        )

        @event.listens_for(engine, "connect")
        def _set_pragmas(dbapi_conn, _):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        _db_engine = engine
    return _db_engine


def init_db() -> None:
    """Create tables if they don't exist. Call once at app startup."""
    engine = _get_engine()
    SQLModel.metadata.create_all(engine)

    def _add_column_if_missing(conn, table: str, col_ddl: str) -> None:
        try:
            conn.execute(text(col_ddl))
            conn.commit()
        except exc.OperationalError:
            conn.rollback()  # column already exists (concurrent startup or re-run)

    with engine.connect() as conn:
        _add_column_if_missing(
            conn,
            "chats",
            "ALTER TABLE chats ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0",
        )
        _add_column_if_missing(
            conn,
            "repos",
            "ALTER TABLE repos ADD COLUMN branch TEXT",
        )
