"""
Import dependency extractor — parses source files to build an internal
module dependency graph (nodes = files, edges = import relationships).

Supported languages: Python, JavaScript, TypeScript (including JSX/TSX).
Only internal imports (files that exist in the repo) are included.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

_EXT_TO_LANG: dict[str, str] = {
    ".py":  "python",
    ".js":  "javascript",
    ".jsx": "javascript",
    ".ts":  "typescript",
    ".tsx": "typescript",
}

# Matches: import ... from '...' / import '...' / require('...')
_JS_IMPORT_RE = re.compile(
    r"""(?:import\s+(?:[^'";\n]*?\s+from\s+)?|require\s*\()\s*['"]([^'"]+)['"]""",
    re.MULTILINE,
)

_JS_EXTS = (".ts", ".tsx", ".js", ".jsx")

_SKIP_DIRS = frozenset({
    ".git", "node_modules", "__pycache__", ".venv", "venv", "env",
    "dist", "build", ".next", "out", "vendor", ".idea", ".vscode",
})


def walk_source_files(repo_root: Path) -> list[Path]:
    """Return all JS/TS/Python source files under repo_root."""
    exts = frozenset(_EXT_TO_LANG)
    result: list[Path] = []
    for path in repo_root.rglob("*"):
        if any(part in _SKIP_DIRS for part in path.parts):
            continue
        if path.suffix in exts and path.is_file():
            result.append(path)
    return result


def extract_dep_edges(file_paths: list[Path], repo_root: Path) -> list[tuple[str, str]]:
    """
    Parse import statements and return (source_rel, target_rel) pairs for
    internal dependencies. Paths are POSIX-style, relative to repo_root.
    """
    known_abs: set[Path] = set(file_paths)
    edges: set[tuple[str, str]] = set()

    for path in file_paths:
        lang = _EXT_TO_LANG.get(path.suffix)
        if not lang:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        source_rel = path.relative_to(repo_root).as_posix()

        if lang == "python":
            targets = _python_imports(text, path, repo_root, known_abs)
        else:
            targets = _js_imports(text, path, known_abs)

        for target in targets:
            target_rel = target.relative_to(repo_root).as_posix()
            if source_rel != target_rel:
                edges.add((source_rel, target_rel))

    return list(edges)


# ---------------------------------------------------------------------------
# Python import resolution
# ---------------------------------------------------------------------------

def _python_imports(
    source: str, source_abs: Path, repo_root: Path, known_abs: set[Path]
) -> list[Path]:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []

    results: list[Path] = []
    source_dir = source_abs.parent

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                t = _py_resolve(alias.name, repo_root, known_abs)
                if t:
                    results.append(t)

        elif isinstance(node, ast.ImportFrom):
            level = node.level or 0
            module = node.module or ""
            if level > 0:
                # Relative import: navigate up `level - 1` dirs from source_dir
                base = source_dir
                for _ in range(level - 1):
                    base = base.parent
                if module:
                    t = _py_resolve(module, base, known_abs)
                    if t:
                        results.append(t)
                else:
                    # from . import name1, name2
                    for alias in node.names:
                        t = _py_resolve(alias.name, base, known_abs)
                        if t:
                            results.append(t)
            elif module:
                t = _py_resolve(module, repo_root, known_abs)
                if t:
                    results.append(t)

    return results


def _py_resolve(module: str, base: Path, known_abs: set[Path]) -> Path | None:
    if not module:
        return None
    parts = module.split(".")
    # Try foo/bar.py
    candidate = base.joinpath(*parts).with_suffix(".py")
    if candidate in known_abs:
        return candidate
    # Try foo/bar/__init__.py
    candidate = base.joinpath(*parts, "__init__.py")
    if candidate in known_abs:
        return candidate
    return None


# ---------------------------------------------------------------------------
# JS / TS import resolution
# ---------------------------------------------------------------------------

def _js_imports(
    source: str, source_abs: Path, known_abs: set[Path]
) -> list[Path]:
    results: list[Path] = []
    source_dir = source_abs.parent

    for m in _JS_IMPORT_RE.finditer(source):
        spec = m.group(1)
        # Only resolve relative imports; skip packages and path aliases (@/...)
        if not spec.startswith(("./", "../")):
            continue

        base = (source_dir / spec).resolve()

        # Try appending each extension
        found = False
        for ext in _JS_EXTS:
            candidate = Path(str(base) + ext)
            if candidate in known_abs:
                results.append(candidate)
                found = True
                break
        if found:
            continue

        # Try as-is (import may already include extension)
        if base in known_abs:
            results.append(base)
            continue

        # Try index files
        for ext in _JS_EXTS:
            candidate = base / f"index{ext}"
            if candidate in known_abs:
                results.append(candidate)
                break

    return results
