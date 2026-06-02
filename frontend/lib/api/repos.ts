import { api, API_BASE } from "../api";
import type { IndexProgressEvent, IndexRequest, IndexResponse, Repo, RepoStatus } from "@/types";

export function indexRepo(body: IndexRequest): Promise<IndexResponse> {
  return api.post<IndexResponse>("/index", body);
}

export async function* indexRepoStream(
  body: IndexRequest,
  signal?: AbortSignal,
): AsyncGenerator<IndexProgressEvent> {
  const res = await fetch(`${API_BASE}/index/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Indexing failed: ${res.status} ${await res.text()}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const text = line.slice(6).trim();
        if (text) yield JSON.parse(text) as IndexProgressEvent;
      }
    }
  }
}

export function listRepos(): Promise<Repo[]> {
  return api.get<Repo[]>("/repos");
}

export function checkRepoStatus(repoId: string): Promise<RepoStatus> {
  return api.get<RepoStatus>(`/repos/${encodeURIComponent(repoId)}/status`);
}

export function deleteRepo(repoId: string): Promise<{ status: string }> {
  return api.del<{ status: string }>(`/repos/${encodeURIComponent(repoId)}`);
}
