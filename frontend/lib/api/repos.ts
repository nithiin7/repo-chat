import { api } from "../api";
import type { IndexRequest, IndexResponse, Repo, RepoStatus } from "@/types";

export function indexRepo(body: IndexRequest): Promise<IndexResponse> {
  return api.post<IndexResponse>("/index", body);
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
