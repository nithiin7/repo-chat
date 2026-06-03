import json
import uuid
from datetime import UTC, datetime

from backend.persistence.engine import _get_engine
from backend.tables.diff import Diff
from sqlmodel import Session, select


def save_diff(
    repo_id: str,
    source_url: str | None,
    source_type: str,
    title: str,
    files_changed: int,
    additions: int,
    deletions: int,
    diff_data: list[dict],
) -> Diff:
    diff = Diff(
        id=str(uuid.uuid4()),
        repo_id=repo_id,
        source_url=source_url,
        source_type=source_type,
        title=title,
        files_changed=files_changed,
        additions=additions,
        deletions=deletions,
        diff_data=json.dumps(diff_data),
        indexed_at=datetime.now(UTC).isoformat(),
    )
    with Session(_get_engine()) as session:
        session.add(diff)
        session.commit()
        session.refresh(diff)
    return diff


def get_diff(diff_id: str) -> dict | None:
    with Session(_get_engine()) as session:
        diff = session.get(Diff, diff_id)
        if not diff:
            return None
        return {
            "id": diff.id,
            "repo_id": diff.repo_id,
            "source_url": diff.source_url,
            "source_type": diff.source_type,
            "title": diff.title,
            "files_changed": diff.files_changed,
            "additions": diff.additions,
            "deletions": diff.deletions,
            "diff_data": json.loads(diff.diff_data),
            "indexed_at": diff.indexed_at,
        }


def list_diffs(repo_id: str) -> list[dict]:
    with Session(_get_engine()) as session:
        diffs = session.exec(
            select(Diff).where(Diff.repo_id == repo_id).order_by(Diff.indexed_at.desc())  # type: ignore[arg-type]
        ).all()
        return [
            {
                "id": d.id,
                "repo_id": d.repo_id,
                "source_url": d.source_url,
                "source_type": d.source_type,
                "title": d.title,
                "files_changed": d.files_changed,
                "additions": d.additions,
                "deletions": d.deletions,
                "indexed_at": d.indexed_at,
            }
            for d in diffs
        ]


def delete_diff(diff_id: str) -> bool:
    with Session(_get_engine()) as session:
        diff = session.get(Diff, diff_id)
        if not diff:
            return False
        session.delete(diff)
        session.commit()
    return True
