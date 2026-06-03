# CodeLens — CLAUDE.md

---

## Behavioral Guidelines

Bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```

---

## Project Goal
CodeLens is a RAG-powered codebase Q&A tool.
User pastes a GitHub or Bitbucket URL, the backend
fetches + indexes the repo, then the frontend opens
a chat interface to ask natural language questions
about that codebase. Also supports diff/PR analysis,
semantic code search, symbol navigation, dependency
maps, and health summaries.

---

## Stack

### Backend (Python)
- **FastAPI** — REST API + SSE streaming
- **LlamaIndex** — RAG pipeline, CodeSplitter chunking
- **ChromaDB** — vector store, persisted per repo in `./chroma_db`
- **SQLite via SQLModel** — relational persistence (`repos/codelens.db`); tables: repos, chats, messages, symbols, parent_chunks, diffs
- **HuggingFace embeddings** — `BAAI/bge-small-en-v1.5` default; Ollama embeddings also supported (model names without `/` use Ollama)
- **Ollama** — local LLM backend (`qwen3:4b` default)
- **Anthropic SDK** — cloud LLM (Anthropic provider)
- **openai SDK** — cloud LLM (OpenAI, Groq, Gemini providers all use OpenAI-compatible client)
- **pydantic-settings** — config from `.env` with `repos/settings.json` overlay
- **httpx** — async HTTP client (Ollama calls, settings checks)
- **gitpython + PyGithub** — repo fetching
- **ruff** — linting and formatting

### Backend Core Modules
- `core/fetcher.py` — clone/pull repos, get remote HEAD
- `core/indexer.py` — build/sync/delete ChromaDB index
- `core/hybrid_retriever.py` — BM25 + vector hybrid retrieval with optional scope filtering
- `core/reranker.py` — cross-encoder reranking (togglable via settings)
- `core/llm.py` — LLM abstraction, streaming, token usage tracking, related-question suggestions
- `core/symbol_extractor.py` — extract functions/classes/methods into SQLite
- `core/dep_extractor.py` — static import graph extraction (Python + TypeScript)
- `core/health_analyzer.py` — TODOs, complexity hotspots, test coverage estimate
- `core/diff_fetcher.py` — fetch PR/commit diffs from GitHub or local git

### Frontend (Next.js)
- **Next.js 16** App Router (React 19)
- **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** + **@base-ui/react**
- **TanStack Query v5** — data fetching, caching, mutations
- **react-markdown** + **rehype-highlight** — markdown + code rendering in chat
- **framer-motion** — animations
- **next-themes** — dark/light mode
- **lucide-react** — icons
- SSE streaming via native `EventSource`
- **ESLint + Prettier** — linting and formatting
- **Husky + lint-staged** — pre-commit hooks

### Frontend App Routes
- `/` — landing/hero page
- `/dashboard` — list of indexed repos
- `/chat/[repo_id]` — repo chat hub (sidebar, chat list)
- `/chat/[repo_id]/[chat_id]` — active chat session
- `/search/[repo_id]` — semantic code search
- `/navigate/[repo_id]` — symbol navigator (functions, classes, methods)
- `/depmap/[repo_id]` — interactive dependency map
- `/settings` — LLM + embedding configuration UI

---

## LLM Modes
- **LOCAL**: Ollama (`qwen3:4b` default). No data leaves machine.
- **CLOUD**: Routes to one of four providers based on `cloud_provider` setting:
  - `anthropic` — Anthropic SDK, `claude-sonnet-4-6` default
  - `openai` — OpenAI SDK, `gpt-4o` default; supports custom `openai_base_url`
  - `groq` — OpenAI-compatible client, `llama-3.3-70b-versatile` default
  - `gemini` — OpenAI-compatible client, `gemini-2.0-flash` default
- User selects LOCAL vs CLOUD per chat session via UI toggle.
- Active cloud provider and model are changed via the Settings page.

---

## Configuration
- `backend/.env` — base config (never committed with secrets)
- `repos/settings.json` — runtime overlay; takes precedence over `.env`; written by `PUT /settings` and `POST /settings/embedding/pull`
- API keys are never returned to the frontend — only presence booleans (`has_anthropic_key`, etc.)
- CORS is locked to `http://localhost:3000` and `http://127.0.0.1:3000`
- Frontend reads `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`)

---

## API Contracts

### Indexing
```
POST /index                  { repo_url, force?, github_token?, branch? } → { repo_id, file_count, status }
POST /index/stream           { repo_url, force?, github_token?, branch? } → SSE index progress events
```

### Repos
```
GET  /repos                  → [RepoInfo]
DELETE /repos/{repo_id}      → { status, repo_id }
GET  /repos/{repo_id}/status → { repo_id, has_updates, indexed_commit, remote_commit }
POST /repos/{repo_id}/sync/stream → SSE sync progress events
GET  /repos/{repo_id}/files  → [string]  (relative file paths)
GET  /repos/{repo_id}/chats  → [ChatInfo]
POST /repos/{repo_id}/chats  { title? } → ChatInfo
```

### Chat
```
POST /chat                   { repo_id?, repo_ids?, question, mode, chat_id?, diff_id?, scope_paths? } → SSE token stream
  SSE events: sources, data (tokens), usage, suggestions, [CONTENT_DONE], [DONE], [ERROR]
```

### Chat Management
```
GET    /chats/{chat_id}/messages  → [ChatMessageInfo]
PATCH  /chats/{chat_id}           { title } → ChatInfo  (rename)
PATCH  /chats/{chat_id}/pin       { is_pinned } → ChatInfo
POST   /chats/{chat_id}/fork      { before_message_id? } → ChatInfo
DELETE /chats/{chat_id}           → { status, chat_id }
```

### Search & Navigate
```
GET /repos/{repo_id}/search    ?query=&top_k=   → SearchResponse
GET /repos/{repo_id}/navigate  ?query=&kind=&limit= → NavigateResponse
```

### Analysis
```
GET /repos/{repo_id}/health    → HealthSummaryResponse (todos, complexity hotspots, test coverage)
GET /repos/{repo_id}/deps      → DepGraphResponse (nodes, edges)
```

### Diffs
```
POST   /repos/{repo_id}/diffs  { source_url, github_token? } → DiffIndexResponse
GET    /repos/{repo_id}/diffs  → [DiffInfo]
GET    /diffs/{diff_id}        → DiffInfo
DELETE /diffs/{diff_id}        → { status, diff_id }
```

### Settings
```
GET  /settings                      → SettingsView (keys replaced by booleans)
PUT  /settings                      { ollama_model?, cloud_provider?, anthropic_model?, anthropic_api_key?, openai_model?, openai_base_url?, openai_api_key?, groq_model?, groq_api_key?, gemini_model?, gemini_api_key?, embedding_model?, suggest_related_questions?, use_reranker? } → SettingsView
GET  /settings/embedding/models     → { models: [{ id, name, size }] }
POST /settings/embedding/pull       { model } → { status, model }
GET  /ollama/models                 → { models: [string] }
```

---

## SSE Stream Events (POST /chat)
| Event name   | Data payload                                        |
|--------------|-----------------------------------------------------|
| `sources`    | JSON array of `SourceChunk` objects                 |
| *(default)*  | JSON string — one streamed token                    |
| `usage`      | `{ input_tokens, output_tokens, cost_usd, model }`  |
| `suggestions`| JSON array of suggested follow-up questions         |
| *(default)*  | `"[CONTENT_DONE]"` — answer complete                |
| *(default)*  | `"[DONE]"` — stream finished                        |
| *(default)*  | `"[ERROR] ..."` — error message                     |

---

## Dev Commands
```bash
make backend     # uvicorn backend (port 8000, hot reload)
make frontend    # Next.js dev server (port 3000)
make install     # pip install + npm install
make lint        # ruff check backend
make format      # ruff format backend
make docker      # docker compose up --build
```

---

## Conventions

### Backend
- Type hints everywhere
- Pydantic models for all request/response bodies (in `schemas.py`)
- Stream LLM responses using FastAPI `StreamingResponse`
- Never hardcode keys — use `.env` / `repos/settings.json`
- All DB access goes through `backend/persistence/` functions; never raw SQL in routes
- Routes are split by domain: `routes/repos.py`, `routes/chats.py`, `routes/diffs.py`, `routes/settings.py`
- `get_settings()` is called per-request (not cached) so settings changes apply without restart

### Frontend
- All API calls go through `lib/api/` modules (domain-split: `chats.ts`, `repos.ts`, `diffs.ts`, `search.ts`, `navigate.ts`, `depmap.ts`, `health.ts`, `settings.ts`); `lib/api.ts` exports only the base `api` client and `API_BASE`
- All server state managed via TanStack Query — no manual `useEffect` fetch loops
- No inline styles — Tailwind classes only
- shadcn/ui + @base-ui/react for all UI components
- Handle loading, error, and empty states in every component
- All shared TypeScript types live in `types/index.ts`
