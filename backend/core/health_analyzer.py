import re
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

from backend.persistence.engine import _get_engine
from backend.tables import Symbol
from sqlmodel import Session, select

TODO_RE = re.compile(
    r"(?:#|//)\s*(TODO|FIXME|HACK|XXX|BUG|NOTE)\b:?\s*(.*)",
    re.IGNORECASE,
)

INDEXABLE_EXTS = {".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".go"}
SKIP_DIRS = {
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "dist",
    "build",
    ".next",
    "vendor",
    ".idea",
    ".vscode",
}

_TEST_FILE_RE = re.compile(
    r"(^|/)tests?/|^test_|_test\.(py|js|ts|tsx|jsx|go|java)$|"
    r"\.(test|spec)\.(js|ts|tsx|jsx)$",
    re.IGNORECASE,
)
_TEST_FUNC_RE = re.compile(r"^test_", re.IGNORECASE)


def _is_test_path(path: str) -> bool:
    return bool(_TEST_FILE_RE.search(path))


def scan_todos(repo_root: Path, max_todos: int = 50) -> list[dict]:
    todos: list[dict] = []
    for f in sorted(repo_root.rglob("*")):
        if f.is_dir():
            continue
        if any(part in SKIP_DIRS for part in f.relative_to(repo_root).parts):
            continue
        if f.suffix not in INDEXABLE_EXTS:
            continue
        try:
            lines = f.read_text(encoding="utf-8", errors="ignore").splitlines()
        except OSError:
            continue
        rel = f.relative_to(repo_root).as_posix()
        for i, line in enumerate(lines, 1):
            m = TODO_RE.search(line)
            if m:
                todos.append(
                    {
                        "file_path": rel,
                        "line": i,
                        "kind": m.group(1).upper(),
                        "text": m.group(2).strip()[:200],
                    }
                )
                if len(todos) >= max_todos:
                    return todos
    return todos


def compute_complexity_hotspots(repo_id: str, top_n: int = 10) -> list[dict]:
    with Session(_get_engine()) as session:
        rows = session.exec(select(Symbol).where(Symbol.repo_id == repo_id)).all()

    if not rows:
        return []

    by_file: dict[str, list[int]] = defaultdict(list)
    for sym in rows:
        by_file[sym.file_path].append(max(0, sym.end_line - sym.start_line))

    hotspots = []
    for file_path, lengths in by_file.items():
        fc = len(lengths)
        avg_len = sum(lengths) / fc
        max_len = max(lengths)
        hotspots.append(
            {
                "file_path": file_path,
                "function_count": fc,
                "avg_function_length": round(avg_len, 1),
                "max_function_length": max_len,
                "score": round(fc * avg_len, 1),
            }
        )

    hotspots.sort(key=lambda x: x["score"], reverse=True)
    return hotspots[:top_n]


def estimate_test_coverage(repo_id: str) -> dict:
    with Session(_get_engine()) as session:
        rows = session.exec(select(Symbol).where(Symbol.repo_id == repo_id)).all()

    all_files = {sym.file_path for sym in rows}
    test_files = {f for f in all_files if _is_test_path(f)}
    source_files = all_files - test_files

    total = len(all_files)
    test_funcs = sum(
        1 for sym in rows if _is_test_path(sym.file_path) or _TEST_FUNC_RE.match(sym.name)
    )

    return {
        "test_file_count": len(test_files),
        "source_file_count": len(source_files),
        "coverage_ratio": round(len(test_files) / total, 3) if total else 0.0,
        "test_function_count": test_funcs,
        "total_function_count": len(rows),
    }


def generate_health_summary(repo_id: str, repo_root: Path | None) -> dict:
    todos = scan_todos(repo_root) if repo_root and repo_root.exists() else []
    return {
        "repo_id": repo_id,
        "todos": todos,
        "complexity_hotspots": compute_complexity_hotspots(repo_id),
        "test_coverage": estimate_test_coverage(repo_id),
        "generated_at": datetime.now(UTC).isoformat(),
    }
