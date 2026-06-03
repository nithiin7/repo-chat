import { api } from "@/lib/api";
import type { DepGraph } from "@/types";

export function fetchDepGraph(repoId: string): Promise<DepGraph> {
  return api.get<DepGraph>(`/repos/${repoId}/deps`);
}
