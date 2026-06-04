from backend.core.dep_extractor import extract_dep_edges, walk_source_files


class TestWalkSourceFiles:
    def test_returns_py_and_ts_files(self, tmp_path):
        (tmp_path / "a.py").write_text("x = 1")
        (tmp_path / "b.ts").write_text("const x = 1;")
        (tmp_path / "c.md").write_text("# readme")

        names = {p.name for p in walk_source_files(tmp_path)}
        assert "a.py" in names
        assert "b.ts" in names
        assert "c.md" not in names

    def test_returns_tsx_and_jsx(self, tmp_path):
        (tmp_path / "App.tsx").write_text("export default () => <div />;")
        (tmp_path / "App.jsx").write_text("export default () => <div />;")

        names = {p.name for p in walk_source_files(tmp_path)}
        assert "App.tsx" in names
        assert "App.jsx" in names

    def test_skips_node_modules(self, tmp_path):
        nm = tmp_path / "node_modules"
        nm.mkdir()
        (nm / "x.ts").write_text("const x = 1;")
        (tmp_path / "app.ts").write_text("import './x'")

        paths = walk_source_files(tmp_path)
        assert all("node_modules" not in p.parts for p in paths)

    def test_skips_venv(self, tmp_path):
        venv = tmp_path / ".venv"
        venv.mkdir()
        (venv / "helper.py").write_text("pass")
        (tmp_path / "main.py").write_text("pass")

        result = walk_source_files(tmp_path)
        assert len(result) == 1
        assert result[0].name == "main.py"

    def test_empty_directory(self, tmp_path):
        assert walk_source_files(tmp_path) == []


class TestExtractDepEdges:
    def test_python_absolute_import(self, tmp_path):
        main = tmp_path / "main.py"
        utils = tmp_path / "utils.py"
        main.write_text("import utils\n")
        utils.write_text("pass")

        edges = extract_dep_edges([main, utils], tmp_path)
        assert ("main.py", "utils.py") in edges

    def test_python_from_import(self, tmp_path):
        (tmp_path / "pkg").mkdir()
        main = tmp_path / "main.py"
        helper = tmp_path / "pkg" / "helper.py"
        main.write_text("from pkg.helper import do_thing\n")
        helper.write_text("def do_thing(): pass")

        edges = extract_dep_edges([main, helper], tmp_path)
        assert ("main.py", "pkg/helper.py") in edges

    def test_python_relative_import(self, tmp_path):
        pkg = tmp_path / "pkg"
        pkg.mkdir()
        a = pkg / "a.py"
        b = pkg / "b.py"
        a.write_text("from . import b\n")
        b.write_text("pass")

        edges = extract_dep_edges([a, b], tmp_path)
        assert ("pkg/a.py", "pkg/b.py") in edges

    def test_no_self_loop(self, tmp_path):
        f = tmp_path / "self_ref.py"
        f.write_text("import self_ref\n")

        edges = extract_dep_edges([f], tmp_path)
        assert ("self_ref.py", "self_ref.py") not in edges

    def test_unknown_import_ignored(self, tmp_path):
        main = tmp_path / "main.py"
        main.write_text("import nonexistent_module\n")

        edges = extract_dep_edges([main], tmp_path)
        assert edges == []

    def test_syntax_error_file_has_no_outgoing_edges(self, tmp_path):
        bad = tmp_path / "bad.py"
        dep = tmp_path / "dep.py"
        bad.write_text("def broken(: pass")
        dep.write_text("pass")

        edges = extract_dep_edges([bad, dep], tmp_path)
        assert not any(src == "bad.py" for src, _ in edges)

    def test_js_relative_import(self, tmp_path):
        src = tmp_path / "src"
        src.mkdir()
        index = src / "index.ts"
        utils = src / "utils.ts"
        index.write_text("import { fn } from './utils';\n")
        utils.write_text("export const fn = () => {};")

        edges = extract_dep_edges([index, utils], tmp_path)
        assert ("src/index.ts", "src/utils.ts") in edges

    def test_js_package_imports_skipped(self, tmp_path):
        index = tmp_path / "index.ts"
        index.write_text("import React from 'react';\nimport axios from 'axios';\n")

        edges = extract_dep_edges([index], tmp_path)
        assert edges == []

    def test_js_import_with_extension(self, tmp_path):
        a = tmp_path / "a.ts"
        b = tmp_path / "b.ts"
        a.write_text("import './b.ts';\n")
        b.write_text("export const x = 1;")

        edges = extract_dep_edges([a, b], tmp_path)
        assert ("a.ts", "b.ts") in edges

    def test_empty_file_list(self, tmp_path):
        assert extract_dep_edges([], tmp_path) == []
