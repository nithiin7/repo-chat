<div align="center">
  <img src="frontend/public/logo.svg" alt="CodeLens Logo" width="180"/>

  <h1>CodeLens</h1>

  <p><strong>Ask natural language questions about any GitHub or Bitbucket codebase — powered by local or cloud LLMs.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"/>
    <img src="https://img.shields.io/badge/python-3.11+-3776AB.svg?logo=python&logoColor=white" alt="Python 3.11+"/>
    <img src="https://img.shields.io/badge/Next.js-16-000000.svg?logo=nextdotjs&logoColor=white" alt="Next.js 16"/>
    <img src="https://img.shields.io/badge/FastAPI-009688.svg?logo=fastapi&logoColor=white" alt="FastAPI"/>
    <img src="https://img.shields.io/badge/LLM-Ollama%20%7C%20Claude%20%7C%20OpenAI-7C3AED.svg" alt="LLM Modes"/>
    <img src="https://img.shields.io/badge/runs%20100%25%20locally-✓-22c55e.svg" alt="Runs locally"/>
  </p>

  <p>
    <a href="#-quick-start">Quick Start</a> ·
    <a href="#-features">Features</a> ·
    <a href="#️-stack">Stack</a> ·
    <a href="#-api">API</a>
  </p>
</div>

---

> Paste a GitHub or Bitbucket URL. CodeLens clones it, indexes every source file into a vector store, and opens a streaming chat so you can explore any codebase in plain English — no manual reading required.

---

## 🖥️ Screenshots

<div align="center">
  <img src="docs/screenshots/chat.png" alt="Chat Interface — ask anything about the codebase" width="800"/>
  <p><em>Ask natural language questions — answers stream token-by-token, grounded in the actual source code</em></p>
</div>

<br/>

<div align="center">
  <table>
    <tr>
      <td align="center">
        <img src="docs/screenshots/dashboard.png" alt="Multi-repo dashboard" width="390"/>
        <br/><em>Multi-repo dashboard</em>
      </td>
      <td align="center">
        <img src="docs/screenshots/depmap.png" alt="Interactive dependency map" width="390"/>
        <br/><em>Interactive dependency map</em>
      </td>
    </tr>
    <tr>
      <td align="center">
        <img src="docs/screenshots/search.png" alt="Semantic code search" width="390"/>
        <br/><em>Semantic code search</em>
      </td>
      <td align="center">
        <img src="docs/screenshots/navigate.png" alt="Symbol navigator" width="390"/>
        <br/><em>AST-based symbol navigator</em>
      </td>
    </tr>
  </table>
</div>

---

## ✨ Features

**Core**
- 🔍 **Natural language Q&A** — ask anything: *"How does auth work?"*, *"Where are API routes defined?"*, *"What does the payment module do?"*
- ⚡ **Streaming responses** — answers stream token-by-token via SSE; no waiting for the full response
- 🔒 **Fully local mode** — run entirely on-device with Ollama; zero data leaves your machine
- ☁️ **Cloud LLM support** — Claude (Anthropic), OpenAI, Groq, and Gemini; toggle per chat session
- 🧠 **Smart code chunking** — tree-sitter–backed `CodeSplitter` understands Python, TypeScript, JavaScript, Go, Java, and more

**Codebase Intelligence**
- 🗺️ **Dependency map** — visualize module-level import relationships as an interactive force-directed graph
- 🔎 **Semantic code search** — search by intent, not keywords; ranked by embedding similarity
- 🧭 **Symbol navigator** — browse every function, class, and method extracted via AST; filter by kind and jump to chat
- 🏥 **Repo health summary** — complexity hotspots, TODO/FIXME/HACK locations, and test coverage estimates

**Advanced**
- 📋 **PR & diff analysis** — paste a GitHub PR URL or commit SHA; ask *"what does this PR change?"* or *"are there risks?"*
- 🔗 **Cross-repo comparison** — select multiple repos and ask comparative questions in a shared chat
- 🔑 **Private repo support** — pass a GitHub PAT directly in the UI; never stored server-side
- 🌿 **Branch selection** — pin indexing to any branch; defaults to remote HEAD

---

## 🚀 Quick Start

### Docker (recommended)

One command starts the backend, frontend, and Ollama together:

```bash
cp backend/.env.example backend/.env   # add cloud API keys if needed
docker compose up --build
```

Open **http://localhost:3000** — that's it.

> **First run:** Ollama starts empty. Pull the model once the container is up:
> ```bash
> docker exec -it <ollama-container-id> ollama pull qwen3:4b
> ```

Vector store and downloaded models persist in named Docker volumes between restarts.

---

### Manual Setup

**Prerequisites:** Python 3.11+, Node.js 22+, [Ollama](https://ollama.com) (for local mode)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**.

---

## 🛠️ Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI + Python 3.11 |
| RAG pipeline | LlamaIndex · CodeSplitter · tree-sitter |
| Vector store | ChromaDB (persisted per repo) |
| Embeddings | `BAAI/bge-small-en-v1.5` — local, no API key needed |
| LLM — local | Ollama (`qwen3:4b` default) |
| LLM — cloud | Anthropic Claude · OpenAI · Groq · Gemini |
| Relational DB | SQLite via SQLModel |
| Frontend | Next.js 16 · TypeScript · Tailwind CSS · shadcn/ui |

---

## 🤖 LLM Modes

| Mode | Provider | Data leaves machine? |
|---|---|---|
| **LOCAL** | Ollama (`qwen3:4b`) | ✗ Never |
| **CLOUD** | Claude (Anthropic) | ✓ Yes |
| **CLOUD** | OpenAI (`gpt-4o`) | ✓ Yes |
| **CLOUD** | Groq (`llama-3.3-70b`) | ✓ Yes |
| **CLOUD** | Gemini (`gemini-2.0-flash`) | ✓ Yes |

Toggle per chat session from the UI. Local mode requires Ollama; cloud mode requires the relevant API key.

---

## 🌐 Supported Languages

CodeSplitter uses tree-sitter for syntax-aware chunking:

`Python` · `TypeScript` · `JavaScript` · `TSX / JSX` · `Go` · `Java`

All other text files are chunked with a sentence-splitter fallback.

---

## 📡 API

| Method | Path | Description |
|---|---|---|
| `POST` | `/index` | Clone and index a repo by URL |
| `POST` | `/index/stream` | Same, but streams indexing progress via SSE |
| `POST` | `/chat` | Stream an answer over SSE |
| `GET` | `/repos` | List all indexed repos |
| `DELETE` | `/repos/{repo_id}` | Remove a repo and its index |
| `GET` | `/repos/{repo_id}/search` | Semantic search — ranked code chunks by embedding similarity |
| `GET` | `/repos/{repo_id}/navigate` | Symbol navigator — functions/classes/methods from AST |
| `GET` | `/repos/{repo_id}/deps` | Dependency graph — nodes (files) + edges (imports) |
| `GET` | `/repos/{repo_id}/health` | Repo health — complexity hotspots, TODOs, test coverage |
| `POST` | `/repos/{repo_id}/diffs` | Fetch and index a PR or commit diff |

---

## ⚙️ Environment Variables

```env
# Local LLM
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:4b

# Cloud LLM (pick any)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=

# Private repos (optional)
GITHUB_TOKEN=
BITBUCKET_USERNAME=
BITBUCKET_APP_PASSWORD=
```

See [backend/.env.example](backend/.env.example) for the full list.

---

## License

MIT — see [LICENSE](LICENSE).
