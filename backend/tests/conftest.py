from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    with (
        patch("backend.main.init_db"),
        patch("backend.main._check_ollama", new_callable=AsyncMock),
    ):
        from backend.main import app

        with TestClient(app) as c:
            yield c
