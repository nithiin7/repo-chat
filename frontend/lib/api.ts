import type { ChatRequest, IndexRequest, IndexResponse, Repo } from "@/types";

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
  onError: (err: Event) => void,
  onDone: () => void
): () => void {
  const params = new URLSearchParams({
    repo_id: body.repo_id,
    question: body.question,
    mode: body.mode,
  });

  // POST /chat returns SSE — open via EventSource-compatible POST using fetch + ReadableStream
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
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              onDone();
              return;
            }
            if (data) onToken(data);
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

export async function deleteRepo(repoId: string): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/repos/${encodeURIComponent(repoId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Delete repo failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<{ status: string }>;
}
