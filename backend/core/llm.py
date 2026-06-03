"""
LLM abstraction — async generators that stream text tokens one by one.

LOCAL mode:  POST to Ollama /api/generate with stream=True, parse NDJSON.
CLOUD mode:  Routes to Anthropic or OpenAI based on the cloud_provider setting.

Public surface:
    stream_answer(question, chunks, mode) -> AsyncGenerator[str, None]
"""

import json
import logging
import re
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from enum import StrEnum

import anthropic
import httpx
import openai
from backend.config import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------


class LLMMode(StrEnum):
    LOCAL = "local"
    CLOUD = "cloud"


class LLMError(Exception):
    """Raised when the LLM backend cannot be reached or is misconfigured."""


@dataclass
class TokenUsage:
    input_tokens: int
    output_tokens: int
    cost_usd: float | None
    model: str

    def to_dict(self) -> dict:
        return {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "cost_usd": self.cost_usd,
            "model": self.model,
        }


# (input $/M tokens, output $/M tokens) — sorted longest-key-first at runtime
_PRICING: dict[str, tuple[float, float]] = {
    "claude-opus-4": (15.0, 75.0),
    "claude-sonnet-4": (3.0, 15.0),
    "claude-haiku-4": (0.80, 4.0),
    "claude-3-5-sonnet": (3.0, 15.0),
    "claude-3-5-haiku": (0.80, 4.0),
    "claude-3-opus": (15.0, 75.0),
    "claude-3-sonnet": (3.0, 15.0),
    "claude-3-haiku": (0.25, 1.25),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4o": (2.50, 10.0),
    "gpt-4-turbo": (10.0, 30.0),
    "gpt-4": (30.0, 60.0),
    "gpt-3.5-turbo": (0.50, 1.50),
    "llama-3.3-70b": (0.59, 0.79),
    "llama-3.1-70b": (0.59, 0.79),
    "llama-3.1-8b": (0.05, 0.08),
    "llama3-70b": (0.59, 0.79),
    "llama3-8b": (0.05, 0.08),
    "mixtral-8x7b": (0.24, 0.24),
    "gemini-2.5-pro": (1.25, 10.0),
    "gemini-2.5-flash": (0.15, 0.60),
    "gemini-2.0-flash": (0.10, 0.40),
    "gemini-1.5-pro": (3.50, 10.50),
    "gemini-1.5-flash": (0.075, 0.30),
}


def _compute_cost(model: str, input_tokens: int, output_tokens: int) -> float | None:
    model_lower = model.lower()
    for key in sorted(_PRICING, key=len, reverse=True):
        if key in model_lower:
            in_price, out_price = _PRICING[key]
            return (input_tokens * in_price + output_tokens * out_price) / 1_000_000
    return None


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = (
    "You are an expert code assistant. "
    "Answer questions about the codebase using only the code excerpts provided. "
    "Be concise. Reference specific file paths or function names when relevant. "
    "If the answer cannot be determined from the excerpts, say so."
)

_MULTI_REPO_SYSTEM_PROMPT = (
    "You are an expert code analyst comparing multiple repositories. "
    "The code excerpts below are grouped by repository under '=== Repository: name ===' headers. "
    "Analyze the patterns, conventions, structure, and approaches visible in each repository's excerpts. "
    "Answer comparative questions directly — name which repo does something better or differently and why, "
    "citing specific file paths, function names, or code patterns as evidence. "
    "Draw reasonable inferences about the overall codebase from the samples provided. "
    "If a specific aspect cannot be determined from the available excerpts, say so clearly "
    "but still compare what is visible."
)

_NO_CONTEXT_MSG = "No relevant code excerpts were found for this question."


def build_prompt(
    question: str,
    context_chunks: list[str],
    diff_context: str | None = None,
) -> str:
    parts: list[str] = []

    if diff_context:
        parts.append(diff_context)
        parts.append("")

    if context_chunks:
        fenced = "\n\n---\n\n".join(context_chunks)
        parts.append(
            f"Use the following code excerpts to answer the question.\n\n---\n\n{fenced}\n\n---"
        )
    else:
        parts.append(_NO_CONTEXT_MSG)

    parts.append(f"\nQuestion: {question}")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Multi-turn context management
# ---------------------------------------------------------------------------

_HISTORY_CHAR_THRESHOLD = 6000  # ~1500 tokens; above this, compress old turns
_HISTORY_KEEP_RECENT = 12  # always keep the most recent 12 messages verbatim

_COMPRESS_PROMPT = (
    "Summarize the following conversation concisely in 3-5 sentences, "
    "capturing what was asked and the key answers given:\n\n{dialogue}"
)


async def _compress_history(history: list[dict[str, str]], mode: "LLMMode") -> list[dict[str, str]]:
    """Summarize old turns when history grows too large, keeping recent ones verbatim."""
    if (
        sum(len(m["content"]) for m in history) <= _HISTORY_CHAR_THRESHOLD
        or len(history) <= _HISTORY_KEEP_RECENT
    ):
        return history

    old, recent = history[:-_HISTORY_KEEP_RECENT], history[-_HISTORY_KEEP_RECENT:]
    dialogue = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in old)
    try:
        summary = await _complete(_COMPRESS_PROMPT.format(dialogue=dialogue[:4000]), mode)
    except Exception:
        return recent  # fallback: drop old turns silently

    return [
        {"role": "user", "content": f"[Earlier conversation summary: {summary}]"},
        {"role": "assistant", "content": "Understood."},
        *recent,
    ]


# ---------------------------------------------------------------------------
# Local — Ollama /api/generate
# ---------------------------------------------------------------------------

_OLLAMA_TIMEOUT = httpx.Timeout(connect=10.0, read=300.0, write=30.0, pool=5.0)


async def stream_local(
    messages: list[dict[str, str]], system: str = _SYSTEM_PROMPT
) -> AsyncGenerator[str, None]:
    settings = get_settings()
    url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
    payload = {
        "model": settings.ollama_model,
        "messages": [{"role": "system", "content": system}, *messages],
        "stream": True,
    }

    try:
        async with (
            httpx.AsyncClient(timeout=_OLLAMA_TIMEOUT) as client,
            client.stream("POST", url, json=payload) as response,
        ):
            if response.status_code != 200:
                body = await response.aread()
                raise LLMError(f"Ollama returned HTTP {response.status_code}: {body.decode()}")
            async for raw_line in response.aiter_lines():
                if not raw_line:
                    continue
                try:
                    data = json.loads(raw_line)
                except json.JSONDecodeError:
                    logger.warning("Ollama: non-JSON line: %s", raw_line)
                    continue

                token: str = data.get("message", {}).get("content", "")
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
        raise LLMError("Ollama stopped responding during generation (read timeout).") from exc


# ---------------------------------------------------------------------------
# Cloud — Anthropic Messages API
# ---------------------------------------------------------------------------


async def stream_anthropic(
    messages: list[dict[str, str]], system: str = _SYSTEM_PROMPT
) -> AsyncGenerator[str | TokenUsage, None]:
    settings = get_settings()

    if not settings.anthropic_api_key:
        raise LLMError("CLOUD mode requires ANTHROPIC_API_KEY to be configured in Settings.")

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    try:
        async with client.messages.stream(
            model=settings.anthropic_model,
            max_tokens=2048,
            system=system,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                if text:
                    yield text
            final = stream.get_final_message()
            usage = final.usage
            yield TokenUsage(
                input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens,
                cost_usd=_compute_cost(
                    settings.anthropic_model, usage.input_tokens, usage.output_tokens
                ),
                model=settings.anthropic_model,
            )

    except anthropic.AuthenticationError as exc:
        raise LLMError("Anthropic authentication failed. Check your API key in Settings.") from exc
    except anthropic.RateLimitError as exc:
        raise LLMError("Anthropic rate limit reached. Please retry in a moment.") from exc
    except anthropic.APIConnectionError as exc:
        raise LLMError("Cannot reach the Anthropic API. Check your network connection.") from exc
    except anthropic.APIStatusError as exc:
        raise LLMError(f"Anthropic API error {exc.status_code}: {exc.message}") from exc


# ---------------------------------------------------------------------------
# Cloud — OpenAI (or compatible)
# ---------------------------------------------------------------------------


async def stream_openai(
    messages: list[dict[str, str]], system: str = _SYSTEM_PROMPT
) -> AsyncGenerator[str | TokenUsage, None]:
    settings = get_settings()

    if not settings.openai_api_key:
        raise LLMError("CLOUD mode requires OPENAI_API_KEY to be configured in Settings.")

    client = openai.AsyncOpenAI(
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
    )

    try:
        stream = await client.chat.completions.create(
            model=settings.openai_model,
            max_tokens=2048,
            messages=[{"role": "system", "content": system}, *messages],
            stream=True,
            stream_options={"include_usage": True},
        )
        prompt_tokens = 0
        completion_tokens = 0
        async for chunk in stream:
            if chunk.choices:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
            if chunk.usage:
                prompt_tokens = chunk.usage.prompt_tokens or 0
                completion_tokens = chunk.usage.completion_tokens or 0
        if prompt_tokens or completion_tokens:
            yield TokenUsage(
                input_tokens=prompt_tokens,
                output_tokens=completion_tokens,
                cost_usd=_compute_cost(settings.openai_model, prompt_tokens, completion_tokens),
                model=settings.openai_model,
            )

    except openai.AuthenticationError as exc:
        raise LLMError("OpenAI authentication failed. Check your API key in Settings.") from exc
    except openai.RateLimitError as exc:
        raise LLMError("OpenAI rate limit reached. Please retry in a moment.") from exc
    except openai.APIConnectionError as exc:
        raise LLMError("Cannot reach the OpenAI API. Check your network connection.") from exc
    except openai.APIStatusError as exc:
        raise LLMError(f"OpenAI API error {exc.status_code}: {exc.message}") from exc


# ---------------------------------------------------------------------------
# Cloud — Groq (OpenAI-compatible)
# ---------------------------------------------------------------------------


async def stream_groq(
    messages: list[dict[str, str]], system: str = _SYSTEM_PROMPT
) -> AsyncGenerator[str | TokenUsage, None]:
    settings = get_settings()

    if not settings.groq_api_key:
        raise LLMError("CLOUD mode requires GROQ_API_KEY to be configured in Settings.")

    client = openai.AsyncOpenAI(
        api_key=settings.groq_api_key,
        base_url="https://api.groq.com/openai/v1",
    )

    try:
        stream = await client.chat.completions.create(
            model=settings.groq_model,
            max_tokens=2048,
            messages=[{"role": "system", "content": system}, *messages],
            stream=True,
            stream_options={"include_usage": True},
        )
        prompt_tokens = 0
        completion_tokens = 0
        async for chunk in stream:
            if chunk.choices:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
            if chunk.usage:
                prompt_tokens = chunk.usage.prompt_tokens or 0
                completion_tokens = chunk.usage.completion_tokens or 0
        if prompt_tokens or completion_tokens:
            yield TokenUsage(
                input_tokens=prompt_tokens,
                output_tokens=completion_tokens,
                cost_usd=_compute_cost(settings.groq_model, prompt_tokens, completion_tokens),
                model=settings.groq_model,
            )

    except openai.AuthenticationError as exc:
        raise LLMError("Groq authentication failed. Check your API key in Settings.") from exc
    except openai.RateLimitError as exc:
        raise LLMError("Groq rate limit reached. Please retry in a moment.") from exc
    except openai.APIConnectionError as exc:
        raise LLMError("Cannot reach the Groq API. Check your network connection.") from exc
    except openai.APIStatusError as exc:
        raise LLMError(f"Groq API error {exc.status_code}: {exc.message}") from exc


# ---------------------------------------------------------------------------
# Cloud — Google Gemini (OpenAI-compatible endpoint)
# ---------------------------------------------------------------------------


async def stream_gemini(
    messages: list[dict[str, str]], system: str = _SYSTEM_PROMPT
) -> AsyncGenerator[str | TokenUsage, None]:
    settings = get_settings()

    if not settings.gemini_api_key:
        raise LLMError("CLOUD mode requires GEMINI_API_KEY to be configured in Settings.")

    client = openai.AsyncOpenAI(
        api_key=settings.gemini_api_key,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    )

    try:
        stream = await client.chat.completions.create(
            model=settings.gemini_model,
            max_tokens=2048,
            messages=[{"role": "system", "content": system}, *messages],
            stream=True,
            stream_options={"include_usage": True},
        )
        prompt_tokens = 0
        completion_tokens = 0
        async for chunk in stream:
            if chunk.choices:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
            if chunk.usage:
                prompt_tokens = chunk.usage.prompt_tokens or 0
                completion_tokens = chunk.usage.completion_tokens or 0
        if prompt_tokens or completion_tokens:
            yield TokenUsage(
                input_tokens=prompt_tokens,
                output_tokens=completion_tokens,
                cost_usd=_compute_cost(settings.gemini_model, prompt_tokens, completion_tokens),
                model=settings.gemini_model,
            )

    except openai.AuthenticationError as exc:
        raise LLMError("Gemini authentication failed. Check your API key in Settings.") from exc
    except openai.RateLimitError as exc:
        raise LLMError("Gemini rate limit reached. Please retry in a moment.") from exc
    except openai.APIConnectionError as exc:
        raise LLMError("Cannot reach the Gemini API. Check your network connection.") from exc
    except openai.APIStatusError as exc:
        raise LLMError(f"Gemini API error {exc.status_code}: {exc.message}") from exc


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

_SUGGESTIONS_PROMPT = (
    "The following question was asked about a codebase and an answer was given. "
    "Write exactly 3 short follow-up questions a developer might ask next. "
    "Reply with only the 3 questions, one per line, no numbering, no bullets, no extra text.\n\n"
    "Question: {question}\n\n"
    "Answer: {answer}"
)


async def _complete(prompt: str, mode: LLMMode) -> str:
    """Non-streaming single completion for short tasks like suggestion generation."""
    settings = get_settings()
    if mode is LLMMode.LOCAL:
        url = f"{settings.ollama_base_url.rstrip('/')}/api/generate"
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
            resp = await client.post(
                url, json={"model": settings.ollama_model, "prompt": prompt, "stream": False}
            )
            return resp.json().get("response", "")
    elif mode is LLMMode.CLOUD:
        provider = settings.cloud_provider
        if provider == "openai":
            client = openai.AsyncOpenAI(
                api_key=settings.openai_api_key, base_url=settings.openai_base_url
            )
            resp = await client.chat.completions.create(
                model=settings.openai_model,
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.choices[0].message.content or "" if resp.choices else ""
        elif provider == "groq":
            client = openai.AsyncOpenAI(
                api_key=settings.groq_api_key, base_url="https://api.groq.com/openai/v1"
            )
            resp = await client.chat.completions.create(
                model=settings.groq_model,
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.choices[0].message.content or "" if resp.choices else ""
        elif provider == "gemini":
            client = openai.AsyncOpenAI(
                api_key=settings.gemini_api_key,
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            )
            resp = await client.chat.completions.create(
                model=settings.gemini_model,
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.choices[0].message.content or "" if resp.choices else ""
        else:
            ac = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
            msg = await ac.messages.create(
                model=settings.anthropic_model,
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}],
            )
            return msg.content[0].text if msg.content else ""
    return ""


async def generate_suggestions(question: str, answer: str, mode: LLMMode) -> list[str]:
    """Return up to 3 follow-up question suggestions based on the completed Q&A."""
    prompt = _SUGGESTIONS_PROMPT.format(question=question, answer=answer[:800])
    try:
        raw = await _complete(prompt, mode)
    except Exception:
        return []
    lines = [
        re.sub(r"^[\d\.\-•*]+\s*", "", line).strip() for line in raw.splitlines() if line.strip()
    ]
    return [q for q in lines if q][:3]


async def stream_answer(
    question: str,
    chunks: list[str],
    mode: LLMMode,
    history: list[dict[str, str]] | None = None,
    diff_context: str | None = None,
    system_prompt: str | None = None,
) -> AsyncGenerator[str | TokenUsage, None]:
    system = system_prompt or _SYSTEM_PROMPT
    compressed = await _compress_history(history or [], mode)
    messages = [
        *compressed,
        {"role": "user", "content": build_prompt(question, chunks, diff_context)},
    ]
    logger.debug(
        "stream_answer mode=%s question=%r chunks=%d history=%d",
        mode,
        question[:80],
        len(chunks),
        len(history or []),
    )

    if mode is LLMMode.LOCAL:
        async for token in stream_local(messages, system=system):
            yield token
    elif mode is LLMMode.CLOUD:
        settings = get_settings()
        provider = settings.cloud_provider
        if provider == "openai":
            async for item in stream_openai(messages, system=system):
                yield item
        elif provider == "groq":
            async for item in stream_groq(messages, system=system):
                yield item
        elif provider == "gemini":
            async for item in stream_gemini(messages, system=system):
                yield item
        else:
            async for item in stream_anthropic(messages, system=system):
                yield item
    else:
        raise LLMError(f"Unknown LLM mode: {mode!r}")
