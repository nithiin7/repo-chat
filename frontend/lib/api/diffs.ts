import { api } from "../api";
import type { DiffIndexRequest, DiffIndexResponse, DiffInfo } from "@/types";

export function indexDiff(repoId: string, body: DiffIndexRequest): Promise<DiffIndexResponse> {
  return api.post<DiffIndexResponse>(`/repos/${encodeURIComponent(repoId)}/diffs`, body);
}

export function listDiffs(repoId: string): Promise<DiffInfo[]> {
  return api.get<DiffInfo[]>(`/repos/${encodeURIComponent(repoId)}/diffs`);
}

export function deleteDiff(diffId: string): Promise<{ status: string; diff_id: string }> {
  return api.del(`/diffs/${encodeURIComponent(diffId)}`);
}
