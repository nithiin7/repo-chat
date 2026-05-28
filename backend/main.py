"""
FastAPI application entry point.

Routes
------
POST /index          Index a GitHub or Bitbucket repository.
POST /chat           Stream an LLM response for a question about an indexed repo.
GET  /repos          List all indexed repositories.
DELETE /repos/{repo_id}  Remove a repo's index and metadata.
"""

import uuid
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, HttpUrl

from backend.config import get_settings
from backend.core.fetcher import fetch_repo
from backend.core.indexer import build_index, delete_index
from backend.core.retriever import retrieve
from backend.core.llm import LLMMode, stream_response


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class IndexRequest(BaseModel):
    repo_url: HttpUrl


class IndexResponse(BaseModel):
    repo_id: str
    file_count: int
    status: str


class ChatRequest(BaseModel):
    repo_id: str
    question: str
    mode: LLMMode = LLMMode.LOCAL


class RepoInfo(BaseModel):
    repo_id: str
    name: str
    url: str
    indexed_at: str
    file_count: int


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="CodeLens API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/index", response_model=IndexResponse)
async def index_repo(body: IndexRequest, background_tasks: BackgroundTasks):
    """Fetch and index a remote repository. Returns a repo_id for subsequent queries."""
    ...


@app.post("/chat")
async def chat(body: ChatRequest):
    """Stream an SSE response answering body.question about body.repo_id."""
    ...


@app.get("/repos", response_model=list[RepoInfo])
async def list_repos():
    """Return metadata for all indexed repositories."""
    ...


@app.delete("/repos/{repo_id}")
async def delete_repo(repo_id: str):
    """Delete a repo's vector index and stored metadata."""
    ...
