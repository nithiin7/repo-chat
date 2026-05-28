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
about that codebase.

## Stack
### Backend (Python)
- FastAPI (REST API + SSE streaming)
- LlamaIndex (RAG, CodeSplitter)
- ChromaDB (vector store, persisted per repo)
- HuggingFace bge-small-en-v1.5 (local embeddings)
- Ollama (local LLM)
- Anthropic SDK (Open AI cloud LLM)
- gitpython + PyGithub (repo fetching)

### Frontend (Next.js)
- Next.js 16 App Router
- TypeScript
- Tailwind CSS + shadcn/ui
- Streaming responses via SSE (EventSource)

## LLM Modes
- LOCAL: Ollama, llama3.1:8b. No data leaves machine.
- CLOUD: OpenAI library to use OpenAI, Claude or other models.
- User selects per chat session from UI toggle.

## API Contracts
POST /index     { repo_url: string } → { repo_id, file_count, status }
POST /chat      { repo_id, question, mode } → SSE stream of tokens
GET  /repos     → [{ repo_id, name, url, indexed_at, file_count }]
DELETE /repos/{repo_id} → { status }

## Conventions
### Backend
- Type hints everywhere
- Pydantic models for all request/response bodies
- Stream LLM responses using FastAPI StreamingResponse
- Never hardcode keys — use .env

### Frontend
- All API calls go through lib/api.ts only
- No inline styles — Tailwind classes only
- shadcn/ui for all UI components
- Handle loading, error, and empty states in every component