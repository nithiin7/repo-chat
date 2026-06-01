import { api, API_BASE } from "../api";
import type { Chat, ChatMessage, ChatRequest, SourceChunk } from "@/types";

export function listChats(repoId: string): Promise<Chat[]> {
  return api.get<Chat[]>(`/repos/${encodeURIComponent(repoId)}/chats`);
}

export function createChat(repoId: string, title = "New Chat"): Promise<Chat> {
  return api.post<Chat>(`/repos/${encodeURIComponent(repoId)}/chats`, { title });
}

export function renameChat(chatId: string, title: string): Promise<Chat> {
  return api.patch<Chat>(`/chats/${encodeURIComponent(chatId)}`, { title });
}

export function pinChat(chatId: string, isPinned: boolean): Promise<Chat> {
  return api.patch<Chat>(`/chats/${encodeURIComponent(chatId)}/pin`, { is_pinned: isPinned });
}

export function deleteChatSession(chatId: string): Promise<{ status: string }> {
  return api.del<{ status: string }>(`/chats/${encodeURIComponent(chatId)}`);
}

export function getChatMessages(chatId: string): Promise<ChatMessage[]> {
  return api.get<ChatMessage[]>(`/chats/${encodeURIComponent(chatId)}/messages`);
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
