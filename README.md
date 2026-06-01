<p align="center">
  <img src="frontend/public/logo.svg" alt="CodeLens" width="280"/>
</p>

<p align="center"><strong>Ask natural language questions about any GitHub or Bitbucket codebase — powered by local or cloud LLMs.</strong></p>

Paste a repo URL. CodeLens clones it, indexes every source file into a vector store, and opens a streaming chat interface so you can explore the codebase in plain English — no manual reading required.

---

## Features

- **Instant repo indexing** — paste a GitHub or Bitbucket URL and CodeLens fetches and indexes the entire codebase in seconds
- **Natural language Q&A** — ask anything: "How does auth work?", "Where are API routes defined?", "What does the payment module do?"
- **Streaming responses** — answers stream token-by-token via SSE, no waiting for the full response
- **Local or cloud LLM** — toggle between fully local (Ollama, zero data leaves your machine) and cloud (Claude / OpenAI) per chat session
- **Smart code chunking** — tree-sitter–backed `CodeSplitter` understands Python, TypeScript, JavaScript, Go, Java, and more; falls back gracefully for other file types
- **Persistent vector store** — ChromaDB persists embeddings per repo, so re-opening a repo skips re-indexing
- **Multi-repo dashboard** — browse, switch between, and delete all indexed repos from one place
- **Configurable embeddings** — uses `BAAI/bge-small-en-v1.5` locally by default; swap the model from settings
- **Private repo support** — works with private GitHub repos (via token) and Bitbucket (via app password)
- **Semantic code search** — search across the entire repo by intent, not keywords; results are ranked by embedding similarity with no LLM involved
- **Symbol navigator** — browse every function, class, and method extracted via AST parsing (Python `ast` module; regex for JS/TS/Go/Java); filter by kind, expand definitions inline, and jump to chat from any result
- **Dependency map** — visualize module-level import relationships as an interactive force-directed graph; click any file node to see what it imports and what imports it, with color-coding by language
- **Repo health summary** — auto-generated overview of complexity hotspots (function count + avg length per file), TODO/FIXME/HACK comments with file and line number, and a test coverage estimate derived from the symbol index; surfaced as a collapsible panel inside the chat view
- **Streaming chat history** — each chat session retains message history so you can ask follow-up questions

---

## Demo

> Index a repo → ask a question → get a streamed, context-aware answer grounded in the actual source code.

---

## Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI + Python |
| RAG | LlamaIndex (CodeSplitter + tree-sitter) |
| Vector store | ChromaDB (persisted per repo) |
| Embeddings | `BAAI/bge-small-en-v1.5` (local, no API key needed) |
| LLM — local | Ollama `llama3.1:8b` |
| LLM — cloud | Anthropic Claude / OpenAI (configurable) |
| Frontend | Next.js 16, TypeScript, Tailwind CSS, shadcn/ui |

---

## Quick Start

### Docker (recommended)

The fastest way to run CodeLens locally. Starts the backend, frontend, and Ollama in one command.

```bash
cp backend/.env.example backend/.env   # add cloud API keys if you want cloud mode
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000).

> **First run:** Ollama starts empty. Pull the model once the container is up:
> ```bash
> docker exec -it <ollama-container-id> ollama pull llama3.1:8b
> ```

Vector store and downloaded models persist in named Docker volumes between restarts.

---

### Manual Setup

#### Prerequisites

- Python 3.11+
- Node.js 22+
- [Ollama](https://ollama.com) running locally with `llama3.1:8b` pulled (only needed for local mode)

#### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in API keys as needed
uvicorn main:app --reload
```

#### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## LLM Modes

| Mode | Model | Data leaves machine? |
|---|---|---|
| LOCAL | Ollama `llama3.1:8b` | No |
| CLOUD | Claude (Anthropic) | Yes |
| CLOUD | OpenAI (e.g. `gpt-4o`) | Yes |

Switch modes from the UI toggle per chat session. Local mode requires Ollama running; cloud mode requires the relevant API key in `.env`.

---

## Supported Languages

CodeSplitter uses tree-sitter to parse source files with syntax awareness:

`Python` · `TypeScript` · `JavaScript` · `TSX / JSX` · `Go` · `Java`

All other text files are chunked with a sentence splitter fallback.

---

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/index` | Clone and index a repo by URL |
| `POST` | `/chat` | Stream an answer over SSE |
| `GET` | `/repos` | List all indexed repos |
| `DELETE` | `/repos/{repo_id}` | Remove a repo and its index |
| `GET` | `/repos/{repo_id}/search?query=...&top_k=10` | Semantic search — returns ranked code chunks by embedding similarity |
| `GET` | `/repos/{repo_id}/navigate?query=...&kind=function&limit=50` | Symbol navigator — returns functions/classes/methods parsed from the AST |
| `GET` | `/repos/{repo_id}/deps` | Dependency graph — nodes (files) and edges (import relationships) for the entire repo |
| `GET` | `/repos/{repo_id}/health` | Repo health summary — complexity hotspots, TODO/FIXME list, and test coverage estimate |

---

## Environment Variables

Copy `backend/.env.example` and fill in what you need:

```env
# Local LLM
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# Cloud LLM (pick one or both)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Private repos (optional)
GITHUB_TOKEN=
BITBUCKET_USERNAME=
BITBUCKET_APP_PASSWORD=
```

See [backend/.env.example](backend/.env.example) for the full list.

---

## License

MIT
