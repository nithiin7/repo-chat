"""
FastAPI application entry point — CodeLens API.

"""

import logging
import uuid
from contextlib import asynccontextmanager

import httpx
from backend.config import get_settings
from backend.persistence import init_db
from backend.routes import chats, diffs, repos, settings
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


async def _check_ollama() -> None:
    """Warn at startup if the configured Ollama endpoint is unreachable."""
    s = get_settings()
    url = f"{s.ollama_base_url.rstrip('/')}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                logger.warning(
                    "Ollama at %s returned HTTP %d — LOCAL mode will fail until Ollama is running.",
                    s.ollama_base_url,
                    resp.status_code,
                )
    except Exception:
        logger.warning(
            "Cannot reach Ollama at %s — LOCAL mode will fail until Ollama is running (`ollama serve`).",
            s.ollama_base_url,
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    await _check_ollama()
    yield


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Attach a unique X-Request-ID to every request and response."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


app = FastAPI(title="CodeLens API", version="0.1.0", lifespan=lifespan)

app.add_middleware(RequestIDMiddleware)

_cors_origins = [o.strip() for o in get_settings().cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(repos.router)
app.include_router(chats.router)
app.include_router(diffs.router)
app.include_router(settings.router)
