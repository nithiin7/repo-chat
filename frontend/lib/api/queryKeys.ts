export const queryKeys = {
  repos: () => ['repos'] as const,
  repoStatus: (repoId: string) => ['repos', repoId, 'status'] as const,
  chats: (repoId: string) => ['chats', repoId] as const,
  chatMessages: (chatId: string) => ['chatMessages', chatId] as const,
  settings: () => ['settings'] as const,
  ollamaModels: () => ['ollamaModels'] as const,
  embeddingModels: () => ['embeddingModels'] as const,
  search: (repoId: string, query: string, topK: number) => ['search', repoId, query, topK] as const,
  navigate: (repoId: string, query: string, kind: string | undefined) => ['navigate', repoId, query, kind] as const,
  deps: (repoId: string) => ['deps', repoId] as const,
  health: (repoId: string) => ['health', repoId] as const,
}
