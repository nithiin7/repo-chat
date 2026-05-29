import { api } from "../api";
import type { EmbeddingModel, Settings, SettingsUpdate } from "@/types";

export function getSettings(): Promise<Settings> {
  return api.get<Settings>("/settings");
}

export function updateSettings(body: SettingsUpdate): Promise<Settings> {
  return api.put<Settings>("/settings", body);
}

export async function getOllamaModels(): Promise<string[]> {
  try {
    const data = await api.get<{ models: string[] }>("/ollama/models");
    return data.models;
  } catch {
    return [];
  }
}

export async function getEmbeddingModels(): Promise<EmbeddingModel[]> {
  try {
    const data = await api.get<{ models: EmbeddingModel[] }>("/settings/embedding/models");
    return data.models;
  } catch {
    return [];
  }
}

export function pullEmbeddingModel(model: string): Promise<{ status: string; model: string }> {
  return api.post<{ status: string; model: string }>("/settings/embedding/pull", { model });
}
