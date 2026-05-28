"""
LLM abstraction — async generators that stream text tokens one by one.

LOCAL mode:  POST to Ollama /api/generate with stream=True, parse NDJSON.
CLOUD mode:  Routes to Anthropic or OpenAI based on the cloud_provider setting.

Public surface:
    stream_answer(question, chunks, mode) -> AsyncGenerator[str, None]
"""

import json
import logging
from enum import Enum
from typing import AsyncGenerator

import anthropic
import httpx
import openai

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

_OLLAMA_TIMEOUT = httpx.Timeout(connect=10.0, read=300.0, write=30.0, pool=5.0)


async def stream_local(prompt: str) -> AsyncGenerator[str, None]:
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

async def stream_anthropic(prompt: str) -> AsyncGenerator[str, None]:
    settings = get_settings()

    if not settings.anthropic_api_key:
        raise LLMError(
            "CLOUD mode requires ANTHROPIC_API_KEY to be configured in Settings."
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
            "Anthropic authentication failed. Check your API key in Settings."
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
# Cloud — OpenAI (or compatible)
# ---------------------------------------------------------------------------

async def stream_openai(prompt: str) -> AsyncGenerator[str, None]:
    settings = get_settings()

    if not settings.openai_api_key:
        raise LLMError(
            "CLOUD mode requires OPENAI_API_KEY to be configured in Settings."
        )

    client = openai.AsyncOpenAI(
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
    )

    try:
        stream = await client.chat.completions.create(
            model=settings.openai_model,
            max_tokens=2048,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta

    except openai.AuthenticationError as exc:
        raise LLMError(
            "OpenAI authentication failed. Check your API key in Settings."
        ) from exc
    except openai.RateLimitError as exc:
        raise LLMError("OpenAI rate limit reached. Please retry in a moment.") from exc
    except openai.APIConnectionError as exc:
        raise LLMError(
            "Cannot reach the OpenAI API. Check your network connection."
        ) from exc
    except openai.APIStatusError as exc:
        raise LLMError(
            f"OpenAI API error {exc.status_code}: {exc.message}"
        ) from exc


# ---------------------------------------------------------------------------
# Cloud — Groq (OpenAI-compatible)
# ---------------------------------------------------------------------------

async def stream_groq(prompt: str) -> AsyncGenerator[str, None]:
    settings = get_settings()

    if not settings.groq_api_key:
        raise LLMError(
            "CLOUD mode requires GROQ_API_KEY to be configured in Settings."
        )

    client = openai.AsyncOpenAI(
        api_key=settings.groq_api_key,
        base_url="https://api.groq.com/openai/v1",
    )

    try:
        stream = await client.chat.completions.create(
            model=settings.groq_model,
            max_tokens=2048,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta

    except openai.AuthenticationError as exc:
        raise LLMError(
            "Groq authentication failed. Check your API key in Settings."
        ) from exc
    except openai.RateLimitError as exc:
        raise LLMError("Groq rate limit reached. Please retry in a moment.") from exc
    except openai.APIConnectionError as exc:
        raise LLMError(
            "Cannot reach the Groq API. Check your network connection."
        ) from exc
    except openai.APIStatusError as exc:
        raise LLMError(
            f"Groq API error {exc.status_code}: {exc.message}"
        ) from exc


# ---------------------------------------------------------------------------
# Cloud — Google Gemini (OpenAI-compatible endpoint)
# ---------------------------------------------------------------------------

async def stream_gemini(prompt: str) -> AsyncGenerator[str, None]:
    settings = get_settings()

    if not settings.gemini_api_key:
        raise LLMError(
            "CLOUD mode requires GEMINI_API_KEY to be configured in Settings."
        )

    client = openai.AsyncOpenAI(
        api_key=settings.gemini_api_key,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    )

    try:
        stream = await client.chat.completions.create(
            model=settings.gemini_model,
            max_tokens=2048,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta

    except openai.AuthenticationError as exc:
        raise LLMError(
            "Gemini authentication failed. Check your API key in Settings."
        ) from exc
    except openai.RateLimitError as exc:
        raise LLMError("Gemini rate limit reached. Please retry in a moment.") from exc
    except openai.APIConnectionError as exc:
        raise LLMError(
            "Cannot reach the Gemini API. Check your network connection."
        ) from exc
    except openai.APIStatusError as exc:
        raise LLMError(
            f"Gemini API error {exc.status_code}: {exc.message}"
        ) from exc


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def stream_answer(
    question: str,
    chunks: list[str],
    mode: LLMMode,
) -> AsyncGenerator[str, None]:
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
        settings = get_settings()
        provider = settings.cloud_provider
        if provider == "openai":
            async for token in stream_openai(prompt):
                yield token
        elif provider == "groq":
            async for token in stream_groq(prompt):
                yield token
        elif provider == "gemini":
            async for token in stream_gemini(prompt):
                yield token
        else:
            async for token in stream_anthropic(prompt):
                yield token
    else:
        raise LLMError(f"Unknown LLM mode: {mode!r}")
