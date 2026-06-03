"""
Application configuration — loads settings from environment variables via pydantic-settings,
with a user-editable overlay stored in settings.json that takes precedence.
"""

import json
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # LLM — Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3:4b"

    # LLM — Cloud provider selection
    cloud_provider: str = "anthropic"  # "anthropic" | "openai" | "groq" | "gemini"

    # LLM — Anthropic
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"

    # LLM — OpenAI (or compatible)
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o"

    # LLM — Groq
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # LLM — Google Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    # Embeddings — Ollama model names (no "/") use OllamaEmbedding;
    # HuggingFace Hub paths (e.g. "BAAI/bge-small-en-v1.5") use HuggingFaceEmbedding.
    embedding_model: str = "nomic-embed-text"

    # Chat behaviour
    suggest_related_questions: bool = False
    use_reranker: bool = False

    # ChromaDB
    chroma_persist_dir: str = "./chroma_db"

    # GitHub / Bitbucket
    github_token: str = ""
    bitbucket_username: str = ""
    bitbucket_app_password: str = ""

    # Misc
    repos_dir: str = "./repos"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


def _overlay_path() -> Path:
    base = Settings().repos_dir
    return Path(base) / "settings.json"


def _load_overlay() -> dict:
    path = _overlay_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def get_settings() -> Settings:
    """
    Return a Settings instance with env/.env as defaults and settings.json
    values layered on top. Called fresh on every request so UI changes take
    effect without restarting the server.
    """
    base = Settings()
    overlay = _load_overlay()
    if not overlay:
        return base
    return base.model_copy(update=overlay)


def save_settings_overlay(updates: dict) -> None:
    """Persist user-configurable overrides to settings.json."""
    path = _overlay_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    existing = _load_overlay()
    existing.update(updates)
    path.write_text(json.dumps(existing, indent=2), encoding="utf-8")
