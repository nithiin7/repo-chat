# Contributing to CodeLens

## Prerequisites

| Tool | Version |
|---|---|
| Python | 3.11+ |
| Node.js | 22+ |
| Ollama | latest (local mode only) |

## Local setup

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env   # fill in API keys as needed
uvicorn main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Or run everything at once from the project root:

```bash
make backend   # starts FastAPI on :8000
make frontend  # starts Next.js on :3000
```

## Making changes

- **Backend**: all code lives in `backend/`. Type hints are required on all functions. Use Pydantic models for request/response bodies. Never hardcode secrets — use `.env`.
- **Frontend**: all API calls go through `frontend/lib/api.ts`. Use Tailwind classes only (no inline styles). Use shadcn/ui components.

## Before submitting a PR

```bash
# Backend
cd backend
ruff check .
ruff format .

# Frontend
cd frontend
npm run lint
npx tsc --noEmit
```

These same checks run in CI — a failing check will block the merge.

## Commit messages

This repo uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add branch selection to index endpoint
fix: handle empty chroma collection on first query
chore: bump uvicorn to 0.32.1
```

A `commit-msg` hook (via Husky) enforces this automatically.

## Opening a PR

1. Fork the repo and create a branch from `main`.
2. Make your changes and verify the checklist in the PR template.
3. Open the PR against `main` — CI will run automatically.

## Reporting bugs

Use the [bug report](.github/ISSUE_TEMPLATE/bug_report.md) issue template.

## Security issues

Please do **not** open a public issue. See [SECURITY.md](SECURITY.md) instead.
