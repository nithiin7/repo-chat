# CodeLens

RAG-powered codebase Q&A. Paste a GitHub or Bitbucket URL, and CodeLens indexes the repo so you can ask natural language questions about it.

## Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI + Python |
| RAG | LlamaIndex (CodeSplitter) |
| Vector store | ChromaDB (persisted per repo) |
| Embeddings | `BAAI/bge-small-en-v1.5` (local) |
| LLM — local | Ollama `llama3.1:8b` |
| LLM — cloud | Anthropic Claude / OpenAI |
| Frontend | Next.js 16, TypeScript, Tailwind, shadcn/ui |

## Quick start

### Prerequisites

- Python 3.11+
- Node.js 22+
- [Ollama](https://ollama.com) running locally with `llama3.1:8b` pulled

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in any keys you need
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## LLM modes

| Mode | Model | Data leaves machine? |
|---|---|---|
| LOCAL | Ollama `llama3.1:8b` | No |
| CLOUD | Claude / OpenAI (configurable) | Yes |

Toggle per chat session from the UI.

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/index` | Index a repo by URL |
| `POST` | `/chat` | Stream an answer (SSE) |
| `GET` | `/repos` | List indexed repos |
| `DELETE` | `/repos/{repo_id}` | Remove a repo |

## Environment variables

See [backend/.env.example](backend/.env.example) for the full list.

## License

MIT
