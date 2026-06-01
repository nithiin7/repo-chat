from sqlmodel import Session, select, or_

from backend.persistence.engine import _get_engine
from backend.tables import Symbol


def insert_symbols(repo_id: str, symbols: list[dict]) -> int:
    """Bulk-insert extracted symbols for a repo. Returns count inserted."""
    if not symbols:
        return 0
    with Session(_get_engine()) as session:
        for s in symbols:
            session.add(Symbol(repo_id=repo_id, **s))
        session.commit()
    return len(symbols)


def search_symbols(
    repo_id: str,
    query: str,
    kind: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """
    Search symbols for repo_id whose name, file_path, or signature contains
    query (case-insensitive LIKE). Optionally filter by kind.
    """
    q = f"%{query}%"
    with Session(_get_engine()) as session:
        stmt = (
            select(Symbol)
            .where(Symbol.repo_id == repo_id)
            .where(
                or_(
                    Symbol.name.ilike(q),
                    Symbol.file_path.ilike(q),
                    Symbol.signature.ilike(q),
                )
            )
        )
        if kind:
            stmt = stmt.where(Symbol.kind == kind)
        stmt = stmt.order_by(Symbol.name).limit(limit)
        rows = session.exec(stmt).all()
    return [r.model_dump() for r in rows]


def list_symbols(
    repo_id: str,
    kind: str | None = None,
    limit: int = 100,
) -> list[dict]:
    """Return symbols for a repo without a text filter (for browsing)."""
    with Session(_get_engine()) as session:
        stmt = (
            select(Symbol)
            .where(Symbol.repo_id == repo_id)
        )
        if kind:
            stmt = stmt.where(Symbol.kind == kind)
        stmt = stmt.order_by(Symbol.name).limit(limit)
        rows = session.exec(stmt).all()
    return [r.model_dump() for r in rows]


def delete_symbols(repo_id: str) -> None:
    with Session(_get_engine()) as session:
        rows = session.exec(select(Symbol).where(Symbol.repo_id == repo_id)).all()
        for row in rows:
            session.delete(row)
        session.commit()
