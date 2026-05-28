export interface Repo {
  repo_id: string;
  name: string;
  url: string;
  indexed_at: string;
  file_count: number;
}

export interface IndexRequest {
  repo_url: string;
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
}

export type CloudProvider = "anthropic" | "openai";

export interface Settings {
  ollama_base_url: string;
  ollama_model: string;
  cloud_provider: CloudProvider;
  anthropic_model: string;
  has_anthropic_key: boolean;
  openai_model: string;
  openai_base_url: string;
  has_openai_key: boolean;
}

export interface SettingsUpdate {
  ollama_model?: string;
  cloud_provider?: CloudProvider;
  anthropic_model?: string;
  anthropic_api_key?: string;
  openai_model?: string;
  openai_base_url?: string;
  openai_api_key?: string;
}
