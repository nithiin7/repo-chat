# CodeLens — CLAUDE.md

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