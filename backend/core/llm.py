"""
LLM abstraction — streams token-by-token responses from either the local
Ollama model or a cloud provider (OpenAI-compatible or Anthropic Claude),
depending on the mode selected per chat session.
"""

from typing import AsyncGenerator, List
from enum import Enum

import httpx
import anthropic
from openai import AsyncOpenAI

from backend.config import get_settings


class LLMMode(str, Enum):
    LOCAL = "local"
    CLOUD = "cloud"


def build_prompt(question: str, context_chunks: List[str]) -> str:
    """Format retrieved code chunks + user question into a single prompt."""
    ...


async def stream_local(prompt: str) -> AsyncGenerator[str, None]:
    """Stream tokens from Ollama's /api/generate endpoint."""
    ...


async def stream_cloud(prompt: str) -> AsyncGenerator[str, None]:
    """
    Stream tokens from the configured cloud provider.
    Checks for an Anthropic key first; falls back to OpenAI-compatible endpoint.
    """
    ...


async def stream_response(
    question: str,
    context_chunks: List[str],
    mode: LLMMode,
) -> AsyncGenerator[str, None]:
    """
    Top-level entry point: build the prompt then dispatch to the
    correct streaming backend based on mode.
    """
    ...
