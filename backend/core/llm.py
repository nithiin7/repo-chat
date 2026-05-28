"""
LLM abstraction — async generators that stream text tokens one by one.

LOCAL mode:  POST to Ollama /api/generate with stream=True, parse NDJSON.
CLOUD mode:  Anthropic Messages API with streaming via the official SDK.

Public surface:
    stream_answer(question, chunks, mode) -> AsyncGenerator[str, None]
"""

import json
import logging
from enum import Enum
from typing import AsyncGenerator

import anthropic
import httpx

from backend.config import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

class LLMMode(str, Enum):
    LOCAL = "local"
    CLOUD = "cloud"


class LLMError(Exception):
    """Raised when the LLM backend cannot be reached or is misconfigured."""


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = (
    "You are an expert code assistant. "
    "Answer questions about the codebase using only the code excerpts provided. "
    "Be concise. Reference specific file paths or function names when relevant. "
    "If the answer cannot be determined from the excerpts, say so."
)

_NO_CONTEXT_MSG = "No relevant code excerpts were found for this question."


def build_prompt(question: str, context_chunks: list[str]) -> str:
    """
    Assemble retrieved code chunks and the user question into a single
    user-turn message.  Each chunk is fenced so the model can distinguish
    code from prose.
    """
    if not context_chunks:
        return f"{_NO_CONTEXT_MSG}\n\nQuestion: {question}"

    fenced = "\n\n---\n\n".join(context_chunks)
    return (
        f"Use the following code excerpts to answer the question.\n\n"
        f"---\n\n{fenced}\n\n---\n\n"
        f"Question: {question}"
    )


# ---------------------------------------------------------------------------
# Local — Ollama /api/generate
# ---------------------------------------------------------------------------

# Generous read timeout: local LLMs can be slow on CPU.
_OLLAMA_TIMEOUT = httpx.Timeout(connect=10.0, read=300.0, write=30.0, pool=5.0)


async def stream_local(prompt: str) -> AsyncGenerator[str, None]:
    """
    Stream tokens from Ollama's /api/generate endpoint.

    Ollama returns newline-delimited JSON objects:
        {"model": "...", "response": "<token>", "done": false}
    The final object has "done": true and an empty "response".
    """
    settings = get_settings()
    url = f"{settings.ollama_base_url.rstrip('/')}/api/generate"
    payload = {
        "model": settings.ollama_model,
        "prompt": prompt,
        "stream": True,
    }

    try:
        async with httpx.AsyncClient(timeout=_OLLAMA_TIMEOUT) as client:
            async with client.stream("POST", url, json=payload) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    raise LLMError(
                        f"Ollama returned HTTP {response.status_code}: {body.decode()}"
                    )
                async for raw_line in response.aiter_lines():
                    if not raw_line:
                        continue
                    try:
                        data = json.loads(raw_line)
                    except json.JSONDecodeError:
                        logger.warning("Ollama: non-JSON line: %s", raw_line)
                        continue

                    token: str = data.get("response", "")
                    if token:
                        yield token

                    if data.get("done"):
                        break

    except httpx.ConnectError as exc:
        raise LLMError(
            f"Cannot reach Ollama at '{settings.ollama_base_url}'. "
            "Make sure Ollama is running (`ollama serve`)."
        ) from exc
    except httpx.ReadTimeout as exc:
        raise LLMError(
            "Ollama stopped responding during generation (read timeout)."
        ) from exc


# ---------------------------------------------------------------------------
# Cloud — Anthropic Messages API
# ---------------------------------------------------------------------------

async def stream_cloud(prompt: str) -> AsyncGenerator[str, None]:
    """
    Stream tokens via the Anthropic Messages API.

    Uses the system / user message structure so the model receives clear
    role separation rather than a flat prompt string.

    Requires ANTHROPIC_API_KEY to be set in the environment.
    """
    settings = get_settings()

    if not settings.anthropic_api_key:
        raise LLMError(
            "CLOUD mode requires ANTHROPIC_API_KEY to be set in your .env file."
        )

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    try:
        async with client.messages.stream(
            model=settings.anthropic_model,
            max_tokens=2048,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text in stream.text_stream:
                if text:
                    yield text

    except anthropic.AuthenticationError as exc:
        raise LLMError(
            "Anthropic authentication failed. Check that ANTHROPIC_API_KEY is valid."
        ) from exc
    except anthropic.RateLimitError as exc:
        raise LLMError("Anthropic rate limit reached. Please retry in a moment.") from exc
    except anthropic.APIConnectionError as exc:
        raise LLMError(
            "Cannot reach the Anthropic API. Check your network connection."
        ) from exc
    except anthropic.APIStatusError as exc:
        raise LLMError(
            f"Anthropic API error {exc.status_code}: {exc.message}"
        ) from exc


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def stream_answer(
    question: str,
    chunks: list[str],
    mode: LLMMode,
) -> AsyncGenerator[str, None]:
    """
    Build the RAG prompt from question + retrieved code chunks, then stream
    the LLM's response token by token.

    Yields:
        str — one text token at a time, suitable for SSE forwarding.

    Raises:
        LLMError — on configuration problems or backend connectivity failures.
    """
    prompt = build_prompt(question, chunks)
    logger.debug(
        "stream_answer mode=%s question=%r chunks=%d",
        mode,
        question[:80],
        len(chunks),
    )

    if mode is LLMMode.LOCAL:
        async for token in stream_local(prompt):
            yield token
    elif mode is LLMMode.CLOUD:
        async for token in stream_cloud(prompt):
            yield token
    else:
        raise LLMError(f"Unknown LLM mode: {mode!r}")
