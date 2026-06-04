from unittest.mock import patch

import pytest
from backend.core.health_analyzer import (
    _is_test_path,
    compute_complexity_hotspots,
    estimate_test_coverage,
    scan_todos,
)
from backend.tables import Symbol
from sqlmodel import Session, SQLModel, create_engine


@pytest.fixture
def db_engine():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return engine


def _make_symbol(repo_id: str, file_path: str, name: str = "fn", start: int = 1, end: int = 10):
    return Symbol(
        repo_id=repo_id,
        name=name,
        kind="function",
        file_path=file_path,
        start_line=start,
        end_line=end,
        signature=f"def {name}():",
        snippet=f"def {name}(): pass",
    )


class TestIsTestPath:
    @pytest.mark.parametrize(
        "path,expected",
        [
            ("tests/test_foo.py", True),
            ("test/foo.py", True),
            ("test_utils.py", True),
            ("utils_test.py", True),
            ("foo.test.ts", True),
            ("foo.spec.tsx", True),
            ("src/utils.py", False),
            ("src/component.ts", False),
            ("src/index.tsx", False),
        ],
    )
    def test_patterns(self, path, expected):
        assert _is_test_path(path) == expected


class TestScanTodos:
    def test_finds_python_todo(self, tmp_path):
        (tmp_path / "main.py").write_text("# TODO: fix this\nx = 1\n")

        todos = scan_todos(tmp_path)
        assert len(todos) == 1
        assert todos[0]["kind"] == "TODO"
        assert todos[0]["text"] == "fix this"
        assert todos[0]["file_path"] == "main.py"
        assert todos[0]["line"] == 1

    def test_finds_js_fixme(self, tmp_path):
        (tmp_path / "app.ts").write_text("const x = 1;\n// FIXME: remove this\n")

        todos = scan_todos(tmp_path)
        assert any(t["kind"] == "FIXME" for t in todos)

    def test_finds_multiple_kinds(self, tmp_path):
        (tmp_path / "code.py").write_text("# TODO: task\n# HACK: workaround\n# BUG: known issue\n")

        kinds = {t["kind"] for t in scan_todos(tmp_path)}
        assert kinds == {"TODO", "HACK", "BUG"}

    def test_skips_non_indexable_extensions(self, tmp_path):
        (tmp_path / "readme.md").write_text("# TODO: update docs\n")
        (tmp_path / "data.txt").write_text("# TODO: unused\n")

        assert scan_todos(tmp_path) == []

    def test_skips_skip_dirs(self, tmp_path):
        nm = tmp_path / "node_modules"
        nm.mkdir()
        (nm / "pkg.js").write_text("// TODO: from vendored dep\n")
        (tmp_path / "app.ts").write_text("const x = 1;\n")

        assert scan_todos(tmp_path) == []

    def test_respects_max_todos(self, tmp_path):
        lines = "\n".join(f"# TODO: item {i}" for i in range(20))
        (tmp_path / "big.py").write_text(lines)

        todos = scan_todos(tmp_path, max_todos=5)
        assert len(todos) == 5

    def test_truncates_long_text(self, tmp_path):
        (tmp_path / "f.py").write_text(f"# TODO: {'x' * 300}\n")

        todos = scan_todos(tmp_path)
        assert len(todos[0]["text"]) <= 200

    def test_empty_directory(self, tmp_path):
        assert scan_todos(tmp_path) == []

    def test_case_insensitive_keyword(self, tmp_path):
        (tmp_path / "f.py").write_text("# todo: lowercase\n# Fixme: mixed case\n")

        kinds = {t["kind"] for t in scan_todos(tmp_path)}
        assert kinds == {"TODO", "FIXME"}


class TestComputeComplexityHotspots:
    def test_returns_empty_when_no_symbols(self, db_engine):
        with patch("backend.core.health_analyzer._get_engine", return_value=db_engine):
            result = compute_complexity_hotspots("repo1")
        assert result == []

    def test_ranks_by_score(self, db_engine):
        syms = [
            _make_symbol("r1", "big.py", start=1, end=100),
            _make_symbol("r1", "big.py", "fn2", start=101, end=200),
            _make_symbol("r1", "small.py", start=1, end=5),
        ]
        with Session(db_engine) as session:
            for s in syms:
                session.add(s)
            session.commit()

        with patch("backend.core.health_analyzer._get_engine", return_value=db_engine):
            hotspots = compute_complexity_hotspots("r1")

        assert hotspots[0]["file_path"] == "big.py"

    def test_respects_top_n(self, db_engine):
        syms = [_make_symbol("r1", f"file{i}.py") for i in range(5)]
        with Session(db_engine) as session:
            for s in syms:
                session.add(s)
            session.commit()

        with patch("backend.core.health_analyzer._get_engine", return_value=db_engine):
            hotspots = compute_complexity_hotspots("r1", top_n=3)

        assert len(hotspots) == 3

    def test_hotspot_shape(self, db_engine):
        with Session(db_engine) as session:
            session.add(_make_symbol("r1", "a.py", start=1, end=20))
            session.commit()

        with patch("backend.core.health_analyzer._get_engine", return_value=db_engine):
            hotspots = compute_complexity_hotspots("r1")

        h = hotspots[0]
        assert "file_path" in h
        assert "function_count" in h
        assert "avg_function_length" in h
        assert "max_function_length" in h
        assert "score" in h


class TestEstimateTestCoverage:
    def test_no_symbols_returns_zeros(self, db_engine):
        with patch("backend.core.health_analyzer._get_engine", return_value=db_engine):
            result = estimate_test_coverage("repo1")

        assert result["coverage_ratio"] == 0.0
        assert result["test_function_count"] == 0
        assert result["total_function_count"] == 0

    def test_counts_test_and_source_files(self, db_engine):
        syms = [
            _make_symbol("r1", "src/main.py"),
            _make_symbol("r1", "tests/test_main.py", "test_something"),
        ]
        with Session(db_engine) as session:
            for s in syms:
                session.add(s)
            session.commit()

        with patch("backend.core.health_analyzer._get_engine", return_value=db_engine):
            result = estimate_test_coverage("r1")

        assert result["test_file_count"] == 1
        assert result["source_file_count"] == 1
        assert result["coverage_ratio"] == 0.5
        assert result["test_function_count"] >= 1
