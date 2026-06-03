"""
Pydantic request/response models for the CodeLens API.
"""

from backend.core.llm import LLMMode
from pydantic import BaseModel, HttpUrl


class IndexRequest(BaseModel):
    repo_url: HttpUrl
    force: bool = False
    github_token: str | None = None
    branch: str | None = None


class IndexResponse(BaseModel):
    repo_id: str
    file_count: int
    status: str


class ChatRequest(BaseModel):
    repo_id: str | None = None
    repo_ids: list[str] | None = None
    question: str
    mode: LLMMode = LLMMode.LOCAL
    chat_id: str | None = None
    diff_id: str | None = None
    scope_paths: list[str] | None = None


class RepoInfo(BaseModel):
    repo_id: str
    name: str
    url: str
    indexed_at: str
    file_count: int
    last_indexed_commit: str | None = None
    branch: str | None = None


class RepoStatusResponse(BaseModel):
    repo_id: str
    has_updates: bool
    indexed_commit: str | None = None
    remote_commit: str | None = None


class ChatInfo(BaseModel):
    id: str
    repo_id: str
    title: str
    is_pinned: bool = False
    created_at: str
    updated_at: str


class CreateChatRequest(BaseModel):
    title: str = "New Chat"


class RenameChatRequest(BaseModel):
    title: str


class PinChatRequest(BaseModel):
    is_pinned: bool


class ForkChatRequest(BaseModel):
    before_message_id: str | None = None


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
    use_reranker: bool


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
    use_reranker: bool | None = None


class EmbeddingPullRequest(BaseModel):
    model: str


class SearchResultItem(BaseModel):
    file_path: str
    chunk: str
    score: float


class SearchResponse(BaseModel):
    repo_id: str
    query: str
    results: list[SearchResultItem]


class SymbolItem(BaseModel):
    id: int
    repo_id: str
    name: str
    kind: str
    file_path: str
    start_line: int
    end_line: int
    signature: str
    snippet: str


class NavigateResponse(BaseModel):
    repo_id: str
    query: str
    kind: str | None
    results: list[SymbolItem]


class DepNode(BaseModel):
    id: str  # POSIX path relative to repo root
    label: str  # filename only
    ext: str  # e.g. ".py", ".ts"


class DepEdge(BaseModel):
    source: str  # node id
    target: str  # node id


class DepGraphResponse(BaseModel):
    repo_id: str
    nodes: list[DepNode]
    edges: list[DepEdge]


class TodoItem(BaseModel):
    file_path: str
    line: int
    kind: str  # TODO | FIXME | HACK | XXX | BUG | NOTE
    text: str


class ComplexityHotspot(BaseModel):
    file_path: str
    function_count: int
    avg_function_length: float
    max_function_length: int
    score: float


class TestCoverageEstimate(BaseModel):
    test_file_count: int
    source_file_count: int
    coverage_ratio: float
    test_function_count: int
    total_function_count: int


class DiffFile(BaseModel):
    file_path: str
    old_path: str | None = None
    change_type: str
    patch: str
    additions: int
    deletions: int


class DiffIndexRequest(BaseModel):
    source_url: str
    github_token: str | None = None


class DiffIndexResponse(BaseModel):
    diff_id: str
    title: str
    files_changed: int
    additions: int
    deletions: int


class DiffInfo(BaseModel):
    id: str
    repo_id: str
    source_url: str | None
    source_type: str
    title: str
    files_changed: int
    additions: int
    deletions: int
    indexed_at: str


class HealthSummaryResponse(BaseModel):
    repo_id: str
    todos: list[TodoItem]
    complexity_hotspots: list[ComplexityHotspot]
    test_coverage: TestCoverageEstimate
    generated_at: str
