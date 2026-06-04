from unittest.mock import patch

MOCK_REPO = {
    "repo_id": "abc123",
    "name": "my-repo",
    "url": "https://github.com/user/my-repo",
    "indexed_at": "2024-01-01T00:00:00+00:00",
    "file_count": 42,
    "last_indexed_commit": "deadbeef",
    "branch": "main",
}

MOCK_CHAT = {
    "id": "chat1",
    "repo_id": "abc123",
    "title": "New Chat",
    "is_pinned": False,
    "created_at": "2024-01-01T00:00:00+00:00",
    "updated_at": "2024-01-01T00:00:00+00:00",
}

MOCK_SYMBOL = {
    "id": 1,
    "repo_id": "abc123",
    "name": "my_func",
    "kind": "function",
    "file_path": "src/main.py",
    "start_line": 1,
    "end_line": 10,
    "signature": "def my_func():",
    "snippet": "def my_func(): pass",
}


class TestListRepos:
    def test_empty_list(self, client):
        with patch("backend.routes.repos.list_repos", return_value=[]):
            response = client.get("/repos")
        assert response.status_code == 200
        assert response.json() == []

    def test_returns_repo_list(self, client):
        with patch("backend.routes.repos.list_repos", return_value=[MOCK_REPO]):
            response = client.get("/repos")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["repo_id"] == "abc123"
        assert data[0]["name"] == "my-repo"
        assert data[0]["file_count"] == 42

    def test_response_shape(self, client):
        with patch("backend.routes.repos.list_repos", return_value=[MOCK_REPO]):
            data = client.get("/repos").json()[0]
        for field in ("repo_id", "name", "url", "indexed_at", "file_count"):
            assert field in data


class TestDeleteRepo:
    def test_not_found_returns_404(self, client):
        with patch("backend.routes.repos.get_repo", return_value=None):
            response = client.delete("/repos/nonexistent")
        assert response.status_code == 404

    def test_success_returns_deleted_status(self, client):
        with (
            patch("backend.routes.repos.get_repo", return_value=MOCK_REPO),
            patch("backend.routes.repos.delete_index"),
            patch("backend.routes.repos.delete_chats_for_repo"),
            patch("backend.routes.repos.delete_repo"),
        ):
            response = client.delete("/repos/abc123")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "deleted"
        assert data["repo_id"] == "abc123"


class TestRepoStatus:
    def test_not_found_returns_404(self, client):
        with patch("backend.routes.repos.get_repo", return_value=None):
            response = client.get("/repos/nonexistent/status")
        assert response.status_code == 404

    def test_up_to_date_when_commits_match(self, client):
        with (
            patch("backend.routes.repos.get_repo", return_value=MOCK_REPO),
            patch("backend.routes.repos.get_remote_head", return_value="deadbeef"),
        ):
            response = client.get("/repos/abc123/status")
        assert response.status_code == 200
        data = response.json()
        assert data["has_updates"] is False
        assert data["indexed_commit"] == "deadbeef"
        assert data["remote_commit"] == "deadbeef"

    def test_has_updates_when_commits_differ(self, client):
        with (
            patch("backend.routes.repos.get_repo", return_value=MOCK_REPO),
            patch("backend.routes.repos.get_remote_head", return_value="newcommit"),
        ):
            response = client.get("/repos/abc123/status")
        assert response.status_code == 200
        assert response.json()["has_updates"] is True
        assert response.json()["remote_commit"] == "newcommit"

    def test_no_updates_when_remote_unreachable(self, client):
        with (
            patch("backend.routes.repos.get_repo", return_value=MOCK_REPO),
            patch("backend.routes.repos.get_remote_head", return_value=None),
        ):
            response = client.get("/repos/abc123/status")
        assert response.status_code == 200
        assert response.json()["has_updates"] is False


class TestListRepoFiles:
    def test_not_found_returns_404(self, client):
        with patch("backend.routes.repos.get_repo", return_value=None):
            response = client.get("/repos/nonexistent/files")
        assert response.status_code == 404

    def test_returns_relative_paths(self, client):
        abs_paths = [
            "/tmp/repos/my-repo/src/main.py",
            "/tmp/repos/my-repo/tests/test_main.py",
        ]
        with (
            patch("backend.routes.repos.get_repo", return_value=MOCK_REPO),
            patch("backend.routes.repos.list_file_paths", return_value=abs_paths),
            patch("backend.routes.repos.get_settings") as mock_settings,
        ):
            mock_settings.return_value.repos_dir = "/tmp/repos"
            response = client.get("/repos/abc123/files")
        assert response.status_code == 200
        paths = response.json()
        assert "src/main.py" in paths
        assert "tests/test_main.py" in paths

    def test_returns_sorted_paths(self, client):
        abs_paths = [
            "/tmp/repos/my-repo/z_file.py",
            "/tmp/repos/my-repo/a_file.py",
        ]
        with (
            patch("backend.routes.repos.get_repo", return_value=MOCK_REPO),
            patch("backend.routes.repos.list_file_paths", return_value=abs_paths),
            patch("backend.routes.repos.get_settings") as mock_settings,
        ):
            mock_settings.return_value.repos_dir = "/tmp/repos"
            response = client.get("/repos/abc123/files")
        paths = response.json()
        assert paths == sorted(paths)


class TestListRepoChats:
    def test_returns_chat_list(self, client):
        with patch("backend.routes.repos.list_chats", return_value=[MOCK_CHAT]):
            response = client.get("/repos/abc123/chats")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == "chat1"

    def test_returns_empty_list(self, client):
        with patch("backend.routes.repos.list_chats", return_value=[]):
            response = client.get("/repos/abc123/chats")
        assert response.status_code == 200
        assert response.json() == []


class TestCreateRepoChat:
    def test_not_found_returns_404(self, client):
        with patch("backend.routes.repos.get_repo", return_value=None):
            response = client.post("/repos/nonexistent/chats", json={})
        assert response.status_code == 404

    def test_creates_chat_with_title(self, client):
        with (
            patch("backend.routes.repos.get_repo", return_value=MOCK_REPO),
            patch("backend.routes.repos.create_chat", return_value=MOCK_CHAT),
        ):
            response = client.post("/repos/abc123/chats", json={"title": "My Chat"})
        assert response.status_code == 200
        assert response.json()["id"] == "chat1"

    def test_creates_chat_without_body(self, client):
        with (
            patch("backend.routes.repos.get_repo", return_value=MOCK_REPO),
            patch("backend.routes.repos.create_chat", return_value=MOCK_CHAT),
        ):
            response = client.post("/repos/abc123/chats")
        assert response.status_code == 200


class TestNavigateRepo:
    def test_not_found_returns_404(self, client):
        with patch("backend.routes.repos.get_repo", return_value=None):
            response = client.get("/repos/nonexistent/navigate")
        assert response.status_code == 404

    def test_invalid_kind_rejected(self, client):
        response = client.get("/repos/abc123/navigate?kind=badkind")
        assert response.status_code == 422

    def test_returns_symbol_list(self, client):
        with (
            patch("backend.routes.repos.get_repo", return_value=MOCK_REPO),
            patch("backend.routes.repos.list_symbols", return_value=[MOCK_SYMBOL]),
        ):
            response = client.get("/repos/abc123/navigate")
        assert response.status_code == 200
        data = response.json()
        assert data["repo_id"] == "abc123"
        assert len(data["results"]) == 1
        assert data["results"][0]["name"] == "my_func"

    def test_valid_kind_filter_accepted(self, client):
        with (
            patch("backend.routes.repos.get_repo", return_value=MOCK_REPO),
            patch("backend.routes.repos.list_symbols", return_value=[]),
        ):
            for kind in ("function", "class", "method"):
                response = client.get(f"/repos/abc123/navigate?kind={kind}")
                assert response.status_code == 200, f"kind={kind} was rejected"

    def test_empty_results(self, client):
        with (
            patch("backend.routes.repos.get_repo", return_value=MOCK_REPO),
            patch("backend.routes.repos.list_symbols", return_value=[]),
        ):
            response = client.get("/repos/abc123/navigate")
        assert response.status_code == 200
        assert response.json()["results"] == []
