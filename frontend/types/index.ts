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
