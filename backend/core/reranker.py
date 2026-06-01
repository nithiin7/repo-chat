"""
Reranker — wraps CrossEncoder to reorder retrieval results by relevance.

The CrossEncoder model is lazy-loaded on first use so startup time is
unaffected when USE_RERANKER is false.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from backend.core.retriever import SourceChunk

if TYPE_CHECKING:
    from sentence_transformers import CrossEncoder as _CrossEncoder

_DEFAULT_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"


class Reranker:
    def __init__(self, model: str = _DEFAULT_MODEL) -> None:
        self._model_name = model
        self._encoder: _CrossEncoder | None = None

    def _load(self) -> _CrossEncoder:
        if self._encoder is None:
            from sentence_transformers import CrossEncoder
            self._encoder = CrossEncoder(self._model_name)
        return self._encoder

    def rerank(self, query: str, chunks: list[SourceChunk]) -> list[SourceChunk]:
        if not chunks:
            return chunks
        encoder = self._load()
        pairs = [(query, sc["chunk"]) for sc in chunks]
        scores: list[float] = encoder.predict(pairs).tolist()
        return [sc for _, sc in sorted(zip(scores, chunks), key=lambda x: x[0], reverse=True)]


_instance: Reranker | None = None


def get_reranker() -> Reranker:
    global _instance
    if _instance is None:
        _instance = Reranker()
    return _instance
