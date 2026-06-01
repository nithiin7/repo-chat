import { api } from "../api";
import type { NavigateResponse } from "@/types";

export function navigateSymbols(
  repoId: string,
  query: string,
  kind?: string,
  limit = 50
): Promise<NavigateResponse> {
  const params = new URLSearchParams({ query, limit: String(limit) });
  if (kind) params.set("kind", kind);
  return api.get<NavigateResponse>(
    `/repos/${encodeURIComponent(repoId)}/navigate?${params}`
  );
}
