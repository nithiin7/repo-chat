from pathlib import Path

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy import text
from sqlmodel import SQLModel, create_engine

from backend.config import get_settings

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
    # Add columns introduced after initial schema (safe no-op if already present)
    with engine.connect() as conn:
        cols = {row[1] for row in conn.execute(text("PRAGMA table_info(chats)"))}
        if "is_pinned" not in cols:
            conn.execute(text("ALTER TABLE chats ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0"))
            conn.commit()
