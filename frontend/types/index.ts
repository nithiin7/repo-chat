export interface Repo {
  repo_id: string;
  name: string;
  url: string;
  indexed_at: string;
  file_count: number;
  last_indexed_commit?: string;
}

export interface RepoStatus {
  repo_id: string;
  has_updates: boolean;
  indexed_commit: string | null;
  remote_commit: string | null;
}

export interface IndexRequest {
  repo_url: string;
  force?: boolean;
}

export interface IndexResponse {
  repo_id: string;
  file_count: number;
  status: string;
}

export interface ChatRequest {
  repo_id: string;
  question: string;
  mode: "local" | "cloud";
  chat_id?: string;
}

export type LLMMode = "local" | "cloud";

export interface SourceChunk {
  file_path: string;
  chunk: string;
  score: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  error?: boolean;
  sources?: SourceChunk[];
  suggestions?: string[];
  suggestionsLoading?: boolean;
}

export interface Chat {
  id: string;
  repo_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  sources: SourceChunk[] | null;
  created_at: string;
}

export type CloudProvider = "anthropic" | "openai" | "groq" | "gemini";

export interface Settings {
  ollama_base_url: string;
  ollama_model: string;
  cloud_provider: CloudProvider;
  anthropic_model: string;
  has_anthropic_key: boolean;
  openai_model: string;
  openai_base_url: string;
  has_openai_key: boolean;
  groq_model: string;
  has_groq_key: boolean;
  gemini_model: string;
  has_gemini_key: boolean;
  embedding_model: string;
  suggest_related_questions: boolean;
}

export interface SettingsUpdate {
  ollama_model?: string;
  cloud_provider?: CloudProvider;
  anthropic_model?: string;
  anthropic_api_key?: string;
  openai_model?: string;
  openai_base_url?: string;
  openai_api_key?: string;
  groq_model?: string;
  groq_api_key?: string;
  gemini_model?: string;
  gemini_api_key?: string;
  embedding_model?: string;
  suggest_related_questions?: boolean;
}

export interface EmbeddingModel {
  id: string;
  name: string;
  size: string;
}

export interface SearchResult {
  file_path: string;
  chunk: string;
  score: number;
}

export interface SearchResponse {
  repo_id: string;
  query: string;
  results: SearchResult[];
}

export interface SymbolItem {
  id: number;
  repo_id: string;
  name: string;
  kind: "function" | "class" | "method";
  file_path: string;
  start_line: number;
  end_line: number;
  signature: string;
  snippet: string;
}

export interface NavigateResponse {
  repo_id: string;
  query: string;
  kind: string | null;
  results: SymbolItem[];
}
