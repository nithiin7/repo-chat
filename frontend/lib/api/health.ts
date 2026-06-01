import { api } from "../api";
import type { HealthSummary } from "@/types";

export function fetchHealthSummary(repoId: string): Promise<HealthSummary> {
  return api.get<HealthSummary>(`/repos/${encodeURIComponent(repoId)}/health`);
}
