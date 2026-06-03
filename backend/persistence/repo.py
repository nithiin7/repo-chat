from sqlmodel import Session, select

from backend.persistence.engine import _get_engine
from backend.tables import Repo


def upsert_repo(
    repo_id: str,
    name: str,
    url: str,
    indexed_at: str,
    file_count: int,
    last_indexed_commit: str | None = None,
    branch: str | None = None,
) -> dict:
    with Session(_get_engine()) as session:
        repo = session.get(Repo, repo_id)
        if repo is None:
            repo = Repo(
                repo_id=repo_id,
                name=name,
                url=url,
                indexed_at=indexed_at,
                file_count=file_count,
                last_indexed_commit=last_indexed_commit,
                branch=branch,
            )
        else:
            repo.name = name
            repo.url = url
            repo.indexed_at = indexed_at
            repo.file_count = file_count
            repo.last_indexed_commit = last_indexed_commit
            repo.branch = branch
        session.add(repo)
        session.commit()
        session.refresh(repo)
    return repo.model_dump()


def list_repos() -> list[dict]:
    with Session(_get_engine()) as session:
        repos = session.exec(select(Repo).order_by(Repo.indexed_at.desc())).all()
    return [r.model_dump() for r in repos]


def get_repo(repo_id: str) -> dict | None:
    with Session(_get_engine()) as session:
        repo = session.get(Repo, repo_id)
    return repo.model_dump() if repo else None


def delete_repo(repo_id: str) -> None:
    with Session(_get_engine()) as session:
        repo = session.get(Repo, repo_id)
        if repo:
            session.delete(repo)
            session.commit()
