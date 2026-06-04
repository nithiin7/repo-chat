from unittest.mock import patch

MOCK_CHAT = {
    "id": "chat1",
    "repo_id": "repo1",
    "title": "Test Chat",
    "is_pinned": False,
    "created_at": "2024-01-01T00:00:00+00:00",
    "updated_at": "2024-01-01T00:00:00+00:00",
}

MOCK_MESSAGE = {
    "id": "msg1",
    "chat_id": "chat1",
    "role": "user",
    "content": "Hello",
    "sources": None,
    "created_at": "2024-01-01T00:00:00+00:00",
}


class TestDeleteChat:
    def test_not_found_returns_404(self, client):
        with patch("backend.routes.chats.get_chat", return_value=None):
            response = client.delete("/chats/nonexistent")
        assert response.status_code == 404

    def test_success_returns_deleted_status(self, client):
        with (
            patch("backend.routes.chats.get_chat", return_value=MOCK_CHAT),
            patch("backend.routes.chats.db_delete_chat"),
        ):
            response = client.delete("/chats/chat1")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "deleted"
        assert data["chat_id"] == "chat1"


class TestRenameChat:
    def test_not_found_returns_404(self, client):
        with patch("backend.routes.chats.get_chat", return_value=None):
            response = client.patch("/chats/nonexistent", json={"title": "New Title"})
        assert response.status_code == 404

    def test_success_returns_updated_chat(self, client):
        updated = {**MOCK_CHAT, "title": "New Title"}
        with (
            patch("backend.routes.chats.get_chat", side_effect=[MOCK_CHAT, updated]),
            patch("backend.routes.chats.db_rename_chat"),
        ):
            response = client.patch("/chats/chat1", json={"title": "New Title"})
        assert response.status_code == 200
        assert response.json()["title"] == "New Title"

    def test_missing_title_field_rejected(self, client):
        response = client.patch("/chats/chat1", json={})
        assert response.status_code == 422


class TestPinChat:
    def test_not_found_returns_404(self, client):
        with patch("backend.routes.chats.get_chat", return_value=None):
            response = client.patch("/chats/nonexistent/pin", json={"is_pinned": True})
        assert response.status_code == 404

    def test_pin_chat(self, client):
        pinned = {**MOCK_CHAT, "is_pinned": True}
        with (
            patch("backend.routes.chats.get_chat", side_effect=[MOCK_CHAT, pinned]),
            patch("backend.routes.chats.pin_chat"),
        ):
            response = client.patch("/chats/chat1/pin", json={"is_pinned": True})
        assert response.status_code == 200
        assert response.json()["is_pinned"] is True

    def test_unpin_chat(self, client):
        unpinned = {**MOCK_CHAT, "is_pinned": False}
        with (
            patch("backend.routes.chats.get_chat", side_effect=[MOCK_CHAT, unpinned]),
            patch("backend.routes.chats.pin_chat"),
        ):
            response = client.patch("/chats/chat1/pin", json={"is_pinned": False})
        assert response.status_code == 200
        assert response.json()["is_pinned"] is False

    def test_missing_is_pinned_field_rejected(self, client):
        response = client.patch("/chats/chat1/pin", json={})
        assert response.status_code == 422


class TestGetChatMessages:
    def test_not_found_returns_404(self, client):
        with patch("backend.routes.chats.get_chat", return_value=None):
            response = client.get("/chats/nonexistent/messages")
        assert response.status_code == 404

    def test_returns_message_list(self, client):
        with (
            patch("backend.routes.chats.get_chat", return_value=MOCK_CHAT),
            patch("backend.routes.chats.list_messages", return_value=[MOCK_MESSAGE]),
        ):
            response = client.get("/chats/chat1/messages")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["role"] == "user"
        assert data[0]["content"] == "Hello"

    def test_returns_empty_list_for_new_chat(self, client):
        with (
            patch("backend.routes.chats.get_chat", return_value=MOCK_CHAT),
            patch("backend.routes.chats.list_messages", return_value=[]),
        ):
            response = client.get("/chats/chat1/messages")
        assert response.status_code == 200
        assert response.json() == []

    def test_message_shape(self, client):
        with (
            patch("backend.routes.chats.get_chat", return_value=MOCK_CHAT),
            patch("backend.routes.chats.list_messages", return_value=[MOCK_MESSAGE]),
        ):
            msg = client.get("/chats/chat1/messages").json()[0]
        for field in ("id", "chat_id", "role", "content", "created_at"):
            assert field in msg


class TestForkChat:
    def test_not_found_returns_404(self, client):
        with patch("backend.routes.chats.get_chat", return_value=None):
            response = client.post("/chats/nonexistent/fork", json={})
        assert response.status_code == 404

    def test_fork_success(self, client):
        forked = {**MOCK_CHAT, "id": "chat2", "title": "Test Chat (fork)"}
        with (
            patch("backend.routes.chats.get_chat", return_value=MOCK_CHAT),
            patch("backend.routes.chats.fork_chat", return_value=forked),
        ):
            response = client.post("/chats/chat1/fork", json={})
        assert response.status_code == 200
        assert response.json()["id"] == "chat2"

    def test_fork_failure_returns_500(self, client):
        with (
            patch("backend.routes.chats.get_chat", return_value=MOCK_CHAT),
            patch("backend.routes.chats.fork_chat", return_value=None),
        ):
            response = client.post("/chats/chat1/fork", json={})
        assert response.status_code == 500
