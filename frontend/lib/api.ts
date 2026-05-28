import type { Chat, ChatMessage, ChatRequest, IndexRequest, IndexResponse, Repo, RepoStatus, Settings, SettingsUpdate, SourceChunk } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function indexRepo(body: IndexRequest): Promise<IndexResponse> {
  const res = await fetch(`${API_BASE}/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Index failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<IndexResponse>;
}

export function chatStream(
  body: ChatRequest,
  onToken: (token: string) => void,
  onSources: (sources: SourceChunk[]) => void,
  onSuggestions: (suggestions: string[]) => void,
  onContentDone: () => void,
  onError: (err: Event) => void,
  onDone: () => void
): () => void {
  const controller = new AbortController();

  fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok || !res.body) {
        throw new Error(`Chat failed: ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "message";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          onDone();
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (currentEvent === "sources") {
              try {
                onSources(JSON.parse(data) as SourceChunk[]);
              } catch {
                // Malformed sources payload — skip silently
              }
            } else if (currentEvent === "suggestions") {
              try {
                onSuggestions(JSON.parse(data) as string[]);
              } catch {
                // Malformed suggestions payload — skip silently
              }
            } else {
              if (data === "[DONE]") {
                onDone();
                return;
              }
              if (data === "[CONTENT_DONE]") {
                onContentDone();
                continue;
              }
              if (data) {
                try {
                  const parsed = JSON.parse(data);
                  onToken(typeof parsed === "string" ? parsed : data);
                } catch {
                  onToken(data);
                }
              }
            }
          } else if (line === "") {
            currentEvent = "message";
          }
        }
      }
    })
    .catch((err: unknown) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      onError(new ErrorEvent("error", { message: String(err) }));
    });

  return () => controller.abort();
}

export async function listRepos(): Promise<Repo[]> {
  const res = await fetch(`${API_BASE}/repos`);
  if (!res.ok) {
    throw new Error(`List repos failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<Repo[]>;
}

export async function checkRepoStatus(repoId: string): Promise<RepoStatus> {
  const res = await fetch(`${API_BASE}/repos/${encodeURIComponent(repoId)}/status`);
  if (!res.ok) {
    throw new Error(`Status check failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<RepoStatus>;
}

export async function deleteRepo(repoId: string): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/repos/${encodeURIComponent(repoId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Delete repo failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<{ status: string }>;
}

// ---------------------------------------------------------------------------
// Chat session API
// ---------------------------------------------------------------------------

export async function listChats(repoId: string): Promise<Chat[]> {
  const res = await fetch(`${API_BASE}/repos/${encodeURIComponent(repoId)}/chats`);
  if (!res.ok) {
    throw new Error(`List chats failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<Chat[]>;
}

export async function createChat(repoId: string, title = "New Chat"): Promise<Chat> {
  const res = await fetch(`${API_BASE}/repos/${encodeURIComponent(repoId)}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    throw new Error(`Create chat failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<Chat>;
}

export async function renameChat(chatId: string, title: string): Promise<Chat> {
  const res = await fetch(`${API_BASE}/chats/${encodeURIComponent(chatId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    throw new Error(`Rename chat failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<Chat>;
}

export async function deleteChatSession(chatId: string): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/chats/${encodeURIComponent(chatId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Delete chat failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<{ status: string }>;
}

export async function getChatMessages(chatId: string): Promise<ChatMessage[]> {
  const res = await fetch(`${API_BASE}/chats/${encodeURIComponent(chatId)}/messages`);
  if (!res.ok) {
    throw new Error(`Get messages failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<ChatMessage[]>;
}

// ---------------------------------------------------------------------------
// Settings API
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<Settings> {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) {
    throw new Error(`Get settings failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<Settings>;
}

export async function updateSettings(body: SettingsUpdate): Promise<Settings> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Update settings failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<Settings>;
}

export async function getOllamaModels(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/ollama/models`);
  if (!res.ok) return [];
  const data = (await res.json()) as { models: string[] };
  return data.models;
}
