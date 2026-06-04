from backend.core.symbol_extractor import _extract_python, _extract_regex, extract_symbols


class TestExtractPython:
    def test_top_level_function(self):
        source = "def hello(name: str) -> str:\n    return f'Hello, {name}'\n"
        syms = _extract_python(source, "utils.py")

        assert len(syms) == 1
        assert syms[0].name == "hello"
        assert syms[0].kind == "function"
        assert syms[0].start_line == 1

    def test_async_function(self):
        source = "async def fetch(url: str):\n    pass\n"
        syms = _extract_python(source, "client.py")

        assert len(syms) == 1
        assert syms[0].name == "fetch"
        assert syms[0].kind == "function"

    def test_class_and_method(self):
        source = "class MyClass:\n    def method(self):\n        pass\n"
        syms = _extract_python(source, "model.py")

        by_name = {s.name: s for s in syms}
        assert "MyClass" in by_name
        assert by_name["MyClass"].kind == "class"
        assert "method" in by_name
        assert by_name["method"].kind == "method"

    def test_nested_function_not_extracted(self):
        source = "def outer():\n    def inner():\n        pass\n"
        syms = _extract_python(source, "f.py")

        names = [s.name for s in syms]
        assert "outer" in names
        assert "inner" not in names

    def test_syntax_error_returns_empty(self):
        syms = _extract_python("def broken(: pass", "bad.py")
        assert syms == []

    def test_empty_source(self):
        assert _extract_python("", "empty.py") == []

    def test_signature_truncated_to_200(self):
        long_sig = "def fn(" + "x" * 300 + "):\n    pass\n"
        syms = _extract_python(long_sig, "f.py")
        assert len(syms[0].signature) <= 200

    def test_snippet_contains_start_of_function(self):
        source = "def add(a, b):\n    return a + b\n"
        syms = _extract_python(source, "math.py")
        assert "def add" in syms[0].snippet

    def test_multiple_top_level_functions(self):
        source = "def fn_a(): pass\n\ndef fn_b(): pass\n"
        syms = _extract_python(source, "f.py")
        names = [s.name for s in syms]
        assert "fn_a" in names
        assert "fn_b" in names


class TestExtractRegex:
    def test_typescript_class(self):
        source = "export class UserService {\n  private users = [];\n}\n"
        syms = _extract_regex(source, "service.ts", "typescript")

        by_name = {s.name: s for s in syms}
        assert "UserService" in by_name
        assert by_name["UserService"].kind == "class"

    def test_typescript_function(self):
        source = "export function formatDate(d: Date): string {\n  return '';\n}\n"
        syms = _extract_regex(source, "utils.ts", "typescript")

        assert any(s.name == "formatDate" for s in syms)

    def test_typescript_arrow_function(self):
        source = (
            "export const fetchData = async (url: string) => {\n  return await fetch(url);\n};\n"
        )
        syms = _extract_regex(source, "api.ts", "typescript")

        assert any(s.name == "fetchData" for s in syms)

    def test_typescript_skips_keywords(self):
        source = "if (true) {\n  for (const x of y) {}\n}\n"
        syms = _extract_regex(source, "code.ts", "typescript")
        names = [s.name for s in syms]
        assert "if" not in names
        assert "for" not in names

    def test_typescript_skips_all_caps_constants(self):
        source = "export const API_KEY = 'secret';\nexport const MAX_RETRIES = 3;\n"
        syms = _extract_regex(source, "constants.ts", "typescript")
        names = [s.name for s in syms]
        assert "API_KEY" not in names
        assert "MAX_RETRIES" not in names

    def test_go_function(self):
        source = "func HandleRequest(w http.ResponseWriter, r *http.Request) {\n}\n"
        syms = _extract_regex(source, "handler.go", "go")
        assert any(s.name == "HandleRequest" for s in syms)

    def test_go_method(self):
        source = "func (s *Server) Start() error {\n    return nil\n}\n"
        syms = _extract_regex(source, "server.go", "go")

        start_sym = next((s for s in syms if s.name == "Start"), None)
        assert start_sym is not None
        assert start_sym.kind == "method"

    def test_go_struct(self):
        source = "type Config struct {\n    Host string\n    Port int\n}\n"
        syms = _extract_regex(source, "config.go", "go")
        assert any(s.name == "Config" for s in syms)

    def test_deduplication(self):
        source = "export class Foo {\n  public bar() {}\n}\n"
        syms = _extract_regex(source, "foo.ts", "typescript")

        keys = [(s.name, s.start_line) for s in syms]
        assert len(keys) == len(set(keys))


class TestExtractSymbols:
    def test_unsupported_extension_skipped(self, tmp_path):
        f = tmp_path / "notes.txt"
        f.write_text("def not_a_function(): pass")
        assert extract_symbols([f]) == []

    def test_python_file(self, tmp_path):
        f = tmp_path / "calc.py"
        f.write_text("def add(a, b):\n    return a + b\n\ndef sub(a, b):\n    return a - b\n")

        names = [s.name for s in extract_symbols([f])]
        assert "add" in names
        assert "sub" in names

    def test_multiple_files(self, tmp_path):
        py_file = tmp_path / "a.py"
        ts_file = tmp_path / "b.ts"
        py_file.write_text("def fn(): pass\n")
        ts_file.write_text("export function tsFunc() {}\n")

        names = [s.name for s in extract_symbols([py_file, ts_file])]
        assert "fn" in names
        assert "tsFunc" in names

    def test_file_path_set_correctly(self, tmp_path):
        f = tmp_path / "module.py"
        f.write_text("def my_fn(): pass\n")

        syms = extract_symbols([f])
        assert syms[0].file_path == str(f)
