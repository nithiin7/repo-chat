"""
Pydantic request/response models for the CodeLens API.
"""

from pydantic import BaseModel, HttpUrl

from backend.core.llm import LLMMode


class IndexRequest(BaseModel):
    repo_url: HttpUrl
    force: bool = False


class IndexResponse(BaseModel):
    repo_id: str
    file_count: int
    status: str


class ChatRequest(BaseModel):
    repo_id: str
    question: str
    mode: LLMMode = LLMMode.LOCAL
    chat_id: str | None = None


class RepoInfo(BaseModel):
    repo_id: str
    name: str
    url: str
    indexed_at: str
    file_count: int
    last_indexed_commit: str | None = None


class RepoStatusResponse(BaseModel):
    repo_id: str
    has_updates: bool
    indexed_commit: str | None = None
    remote_commit: str | None = None


class ChatInfo(BaseModel):
    id: str
    repo_id: str
    title: str
    created_at: str
    updated_at: str


class CreateChatRequest(BaseModel):
    title: str = "New Chat"


class RenameChatRequest(BaseModel):
    title: str


class ChatMessageInfo(BaseModel):
    id: str
    chat_id: str
    role: str
    content: str
    sources: list | None = None
    created_at: str


class SettingsView(BaseModel):
    """Safe settings representation — API keys replaced by presence booleans."""
    ollama_base_url: str
    ollama_model: str
    cloud_provider: str
    anthropic_model: str
    has_anthropic_key: bool
    openai_model: str
    openai_base_url: str
    has_openai_key: bool
    groq_model: str
    has_groq_key: bool
    gemini_model: str
    has_gemini_key: bool
    embedding_model: str
    suggest_related_questions: bool


class SettingsUpdate(BaseModel):
    ollama_model: str | None = None
    cloud_provider: str | None = None
    anthropic_model: str | None = None
    anthropic_api_key: str | None = None
    openai_model: str | None = None
    openai_base_url: str | None = None
    openai_api_key: str | None = None
    groq_model: str | None = None
    groq_api_key: str | None = None
    gemini_model: str | None = None
    gemini_api_key: str | None = None
    embedding_model: str | None = None
    suggest_related_questions: bool | None = None


class EmbeddingPullRequest(BaseModel):
    model: str
