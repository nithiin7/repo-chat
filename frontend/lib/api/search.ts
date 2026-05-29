import { api } from "../api";
import type { SearchResponse } from "@/types";

export function searchCode(
  repoId: string,
  query: string,
  topK = 10
): Promise<SearchResponse> {
  const params = new URLSearchParams({ query, top_k: String(topK) });
  return api.get<SearchResponse>(
    `/repos/${encodeURIComponent(repoId)}/search?${params}`
  );
}
