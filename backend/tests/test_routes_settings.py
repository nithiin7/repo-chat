from unittest.mock import patch


class TestGetSettings:
    def test_returns_settings_view_shape(self, client):
        response = client.get("/settings")
        assert response.status_code == 200
        data = response.json()
        for field in (
            "ollama_model",
            "cloud_provider",
            "has_anthropic_key",
            "has_openai_key",
            "has_groq_key",
            "has_gemini_key",
            "embedding_model",
            "suggest_related_questions",
            "use_reranker",
        ):
            assert field in data

    def test_api_keys_not_exposed(self, client):
        response = client.get("/settings")
        data = response.json()
        assert "anthropic_api_key" not in data
        assert "openai_api_key" not in data
        assert "groq_api_key" not in data
        assert "gemini_api_key" not in data

    def test_has_key_booleans_are_bool(self, client):
        data = client.get("/settings").json()
        assert isinstance(data["has_anthropic_key"], bool)
        assert isinstance(data["has_openai_key"], bool)


class TestUpdateSettings:
    def test_valid_provider_accepted(self, client):
        with patch("backend.routes.settings.save_settings_overlay"):
            response = client.put("/settings", json={"cloud_provider": "openai"})
        assert response.status_code == 200

    def test_invalid_provider_rejected(self, client):
        response = client.put("/settings", json={"cloud_provider": "badprovider"})
        assert response.status_code == 422

    def test_empty_body_succeeds(self, client):
        with patch("backend.routes.settings.save_settings_overlay"):
            response = client.put("/settings", json={})
        assert response.status_code == 200

    def test_ollama_model_update_saved(self, client):
        with patch("backend.routes.settings.save_settings_overlay") as mock_save:
            client.put("/settings", json={"ollama_model": "llama3"})
        mock_save.assert_called_once()
        assert mock_save.call_args[0][0]["ollama_model"] == "llama3"

    def test_toggle_suggest_questions(self, client):
        with patch("backend.routes.settings.save_settings_overlay") as mock_save:
            client.put("/settings", json={"suggest_related_questions": True})
        assert mock_save.call_args[0][0]["suggest_related_questions"] is True

    def test_toggle_reranker(self, client):
        with patch("backend.routes.settings.save_settings_overlay") as mock_save:
            client.put("/settings", json={"use_reranker": True})
        assert mock_save.call_args[0][0]["use_reranker"] is True

    def test_all_valid_providers_accepted(self, client):
        for provider in ("anthropic", "openai", "groq", "gemini"):
            with patch("backend.routes.settings.save_settings_overlay"):
                response = client.put("/settings", json={"cloud_provider": provider})
            assert response.status_code == 200, f"Provider '{provider}' was rejected"

    def test_no_save_when_no_changes(self, client):
        with patch("backend.routes.settings.save_settings_overlay") as mock_save:
            client.put("/settings", json={})
        mock_save.assert_not_called()


class TestEmbeddingModels:
    def test_returns_model_list(self, client):
        response = client.get("/settings/embedding/models")
        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        assert isinstance(data["models"], list)
        assert len(data["models"]) > 0

    def test_each_model_has_required_fields(self, client):
        response = client.get("/settings/embedding/models")
        for model in response.json()["models"]:
            assert "id" in model
            assert "name" in model
            assert "size" in model
