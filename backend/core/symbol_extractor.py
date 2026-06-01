"""
Symbol extractor — walks source files and pulls out every function / method /
class definition.

Strategy per language:
  Python  → built-in ast module (exact, handles nesting correctly)
  JS/TS   → regex (captures function declarations, class declarations,
             method definitions)
  Go      → regex
  Java    → regex

Files in unsupported languages are silently skipped.
"""

from __future__ import annotations

import ast
import logging
import re
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

_EXT_TO_LANG: dict[str, str] = {
    ".py":   "python",
    ".js":   "javascript",
    ".jsx":  "javascript",
    ".ts":   "typescript",
    ".tsx":  "typescript",
    ".go":   "go",
    ".java": "java",
}

_SNIPPET_LINES = 20


@dataclass
class ExtractedSymbol:
    name: str
    kind: str       # "function" | "class" | "method"
    file_path: str
    start_line: int # 1-indexed
    end_line: int
    signature: str  # first line of definition stripped, ≤200 chars
    snippet: str    # first _SNIPPET_LINES lines


def extract_symbols(file_paths: list[Path]) -> list[ExtractedSymbol]:
    """Parse every supported source file and return all symbols found."""
    results: list[ExtractedSymbol] = []
    for path in file_paths:
        lang = _EXT_TO_LANG.get(path.suffix)
        if lang is None:
            continue
        try:
            source = path.read_text(encoding="utf-8", errors="replace")
            if lang == "python":
                results.extend(_extract_python(source, str(path)))
            else:
                results.extend(_extract_regex(source, str(path), lang))
        except Exception as exc:
            logger.debug("Symbol extraction failed for %s: %s", path, exc)
    return results


# ---------------------------------------------------------------------------
# Python — ast module
# ---------------------------------------------------------------------------

def _extract_python(source: str, file_path: str) -> list[ExtractedSymbol]:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []

    lines = source.splitlines()
    symbols: list[ExtractedSymbol] = []
    _walk_ast(tree.body, lines, file_path, in_class=False, symbols=symbols)
    return symbols


def _walk_ast(
    stmts: list[ast.stmt],
    lines: list[str],
    file_path: str,
    in_class: bool,
    symbols: list[ExtractedSymbol],
) -> None:
    for node in stmts:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            kind = "method" if in_class else "function"
            symbols.append(_make_py_symbol(node, kind, lines, file_path))
            # Don't recurse into function bodies to avoid nested helpers
            # being tagged as methods.
        elif isinstance(node, ast.ClassDef):
            symbols.append(_make_py_symbol(node, "class", lines, file_path))
            _walk_ast(node.body, lines, file_path, in_class=True, symbols=symbols)


def _make_py_symbol(
    node: ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef,
    kind: str,
    lines: list[str],
    file_path: str,
) -> ExtractedSymbol:
    start = node.lineno       # 1-indexed
    end   = node.end_lineno or start  # type: ignore[attr-defined]

    sig_line = lines[start - 1].strip()[:200] if start <= len(lines) else ""
    snippet_lines = lines[start - 1 : min(end, start - 1 + _SNIPPET_LINES)]
    return ExtractedSymbol(
        name=node.name,
        kind=kind,
        file_path=file_path,
        start_line=start,
        end_line=end,
        signature=sig_line,
        snippet="\n".join(snippet_lines),
    )


# ---------------------------------------------------------------------------
# Regex — JS/TS, Go, Java
# ---------------------------------------------------------------------------

# Each pattern yields (name, kind) via named groups.
_PATTERNS: dict[str, list[re.Pattern[str]]] = {
    "javascript": [
        # class Foo
        re.compile(r"^\s*(?:export\s+)?(?:default\s+)?class\s+(?P<name>\w+)", re.M),
        # function foo(  — top-level
        re.compile(r"^\s{0,2}(?:export\s+)?(?:async\s+)?function\s+\*?(?P<name>\w+)\s*\(", re.M),
        # const Foo = ... (top-level PascalCase — likely component or class-like)
        re.compile(r"^(?:export\s+(?:default\s+)?)?const\s+(?P<name>[A-Z]\w*)\s*=", re.M),
        # const foo = (...) => or async (...) =>  (explicit arrow function)
        re.compile(r"^(?:export\s+)?const\s+(?P<name>[a-z_$]\w*)\s*=\s*(?:async\s+)?\(", re.M),
        # true class method: indented + access modifier
        re.compile(
            r"^(?P<indent>[ \t]{2,})(?:(?:static|async|get|set)\s+)+(?P<name>[a-zA-Z_$]\w*)\s*\(",
            re.M,
        ),
    ],
    "typescript": [
        re.compile(r"^\s*(?:export\s+)?(?:(?:abstract|default)\s+)*class\s+(?P<name>\w+)", re.M),
        re.compile(r"^\s{0,2}(?:export\s+)?(?:async\s+)?function\s+\*?(?P<name>\w+)\s*\(", re.M),
        # const Foo = ... (PascalCase component or factory)
        re.compile(r"^(?:export\s+(?:default\s+)?)?const\s+(?P<name>[A-Z]\w*)\s*=", re.M),
        # const foo = (...) => (explicit arrow function at top level)
        re.compile(r"^(?:export\s+)?const\s+(?P<name>[a-z_$]\w*)\s*=\s*(?:async\s+)?\(", re.M),
        # TS class methods must have at least one explicit modifier
        re.compile(
            r"^(?P<indent>[ \t]{2,})(?:(?:public|private|protected|static|abstract|override|async|readonly)\s+)+(?P<name>[a-zA-Z_$]\w*)\s*(?:<[^>]*>)?\s*\(",
            re.M,
        ),
    ],
    "go": [
        # func Foo(
        re.compile(r"^func\s+(?P<name>\w+)\s*\(", re.M),
        # func (r Receiver) Foo(
        re.compile(r"^func\s+\([^)]+\)\s+(?P<name>\w+)\s*\(", re.M),
        # type Foo struct
        re.compile(r"^type\s+(?P<name>\w+)\s+struct\b", re.M),
    ],
    "java": [
        re.compile(r"^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:abstract\s+)?class\s+(?P<name>\w+)", re.M),
        re.compile(
            r"^\s*(?:(?:public|private|protected|static|final|abstract|synchronized|native|strictfp)\s+)*"
            r"[\w<>\[\]]+\s+(?P<name>\w+)\s*\(",
            re.M,
        ),
    ],
}
# JS/TS patterns are shared
_PATTERNS["javascript"] = _PATTERNS["javascript"]
_PATTERNS["typescript"] = _PATTERNS["typescript"]

# Keywords that look like method names but are control flow / reserved words
_SKIP_NAMES = frozenset(
    "if else for while do switch case break continue return throw try catch finally "
    "new delete typeof instanceof void in of import export default class extends super "
    "this null undefined true false constructor".split()
)

# All-caps identifiers are constants (API_KEY, TOP_K, etc.), not symbols.
_ALL_CAPS_RE = re.compile(r"^[A-Z][A-Z0-9_]+$")

_JS_INDENT_THRESHOLD = 2   # chars — only count indented lines as methods


def _extract_regex(source: str, file_path: str, lang: str) -> list[ExtractedSymbol]:
    lang_key = "typescript" if lang in ("typescript",) else (
        "javascript" if lang in ("javascript",) else lang
    )
    patterns = _PATTERNS.get(lang_key, [])
    lines = source.splitlines()
    total = len(lines)
    symbols: list[ExtractedSymbol] = []

    for pat in patterns:
        for m in pat.finditer(source):
            name = m.group("name")
            if not name or name in _SKIP_NAMES or _ALL_CAPS_RE.match(name):
                continue

            # For the indented-method regex in JS/TS, require real indentation.
            if "indent" in pat.groupindex:
                indent = m.group("indent")
                if len(indent) < _JS_INDENT_THRESHOLD:
                    continue
                kind = "method"
            elif lang_key in ("javascript", "typescript"):
                kind = "class" if re.match(r"^\s*(?:export\s+)?(?:(?:abstract|default)\s+)*class\b", m.group(0)) else "function"
            elif lang_key == "go":
                raw = m.group(0)
                if "struct" in raw:
                    kind = "class"
                elif re.match(r"^func\s+\(", raw):
                    kind = "method"
                else:
                    kind = "function"
            else:  # java
                raw = m.group(0)
                kind = "class" if "class" in raw else "method"

            # Map byte offset → line number (1-indexed)
            start_line = source[: m.start()].count("\n") + 1
            # Estimate end: go forward until we're back at the same indent level
            end_line = min(start_line + _SNIPPET_LINES - 1, total)

            sig_line = lines[start_line - 1].strip()[:200] if start_line <= total else ""
            snippet_lines = lines[start_line - 1 : min(total, start_line - 1 + _SNIPPET_LINES)]

            symbols.append(
                ExtractedSymbol(
                    name=name,
                    kind=kind,
                    file_path=file_path,
                    start_line=start_line,
                    end_line=end_line,
                    signature=sig_line,
                    snippet="\n".join(snippet_lines),
                )
            )

    # De-duplicate by (name, start_line) — multiple patterns can match the same symbol.
    seen: set[tuple[str, int]] = set()
    unique: list[ExtractedSymbol] = []
    for s in symbols:
        key = (s.name, s.start_line)
        if key not in seen:
            seen.add(key)
            unique.append(s)

    return unique
