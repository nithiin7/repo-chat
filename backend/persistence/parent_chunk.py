from sqlmodel import Session, select

from backend.persistence.engine import _get_engine
from backend.tables import ParentChunk


def save_parent_chunks(repo_id: str, chunks: list[dict]) -> int:
    """Bulk-insert parent chunks for a repo. Returns count inserted."""
    if not chunks:
        return 0
    with Session(_get_engine()) as session:
        for c in chunks:
            session.add(ParentChunk(repo_id=repo_id, **c))
        session.commit()
    return len(chunks)


def get_parent_chunks_by_ids(repo_id: str, ids: list[str]) -> list[ParentChunk]:
    """Fetch parent chunks by UUID list. Returns only rows that exist."""
    if not ids:
        return []
    with Session(_get_engine()) as session:
        rows = session.exec(
            select(ParentChunk)
            .where(ParentChunk.repo_id == repo_id)
            .where(ParentChunk.id.in_(ids))
        ).all()
    return list(rows)


def delete_parent_chunks(repo_id: str) -> None:
    """Delete all parent chunks for a repo. Called on re-index or delete."""
    with Session(_get_engine()) as session:
        rows = session.exec(
            select(ParentChunk).where(ParentChunk.repo_id == repo_id)
        ).all()
        for row in rows:
            session.delete(row)
        session.commit()
