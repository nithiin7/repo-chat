"""
HybridRetriever — fuses dense vector search (ChromaDB/LlamaIndex) with sparse
BM25 keyword search using Reciprocal Rank Fusion (RRF, k=60).

One HybridRetriever is built per repo_id and cached in _cache. The expensive
parts (corpus fetch, BM25 build, VectorStoreIndex init) run once; top_k is
passed per query so the same cached instance serves all call sites.
Call invalidate_cache(repo_id) after re-indexing to force a rebuild.

Construct via make_hybrid_retriever(repo_id) or directly:
    retriever = HybridRetriever(vector_store, all_chunks, embed_model)
    results = retriever.get_relevant_documents(query, top_k=5)
"""

import re

from llama_index.core import VectorStoreIndex
from llama_index.core.embeddings import BaseEmbedding
from llama_index.vector_stores.chroma import ChromaVectorStore
from rank_bm25 import BM25Okapi

from backend.core.retriever import SourceChunk

# Per-repo cache: avoids rebuilding the BM25 index + fetching the full corpus
# on every request. Invalidated by invalidate_cache() when a repo is re-indexed.
_cache: dict[str, "HybridRetriever"] = {}


def _tokenize(text: str) -> list[str]:
    return re.findall(r"\w+", text.lower())


def _doc_id(file_path: str, chunk: str) -> str:
    """Stable dedup key used to merge hits from both retrievers."""
    return f"{file_path}::{chunk[:80]}"


def _rrf_merge(
    ranked_lists: list[list[tuple[str, SourceChunk]]],
    k: int = 60,
) -> list[SourceChunk]:
    """
    Reciprocal Rank Fusion over multiple ranked lists.
    Each list contains (doc_id, SourceChunk) pairs ordered by descending rank.
    Returns a new list of SourceChunk with score set to the RRF score.
    """
    rrf_scores: dict[str, float] = {}
    chunks: dict[str, SourceChunk] = {}

    for ranked_list in ranked_lists:
        for rank, (doc_id, chunk) in enumerate(ranked_list, start=1):
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1.0 / (k + rank)
            chunks[doc_id] = chunk

    return [
        SourceChunk(
            file_path=chunks[did]["file_path"],
            chunk=chunks[did]["chunk"],
            score=rrf_scores[did],
        )
        for did in sorted(rrf_scores, key=lambda d: rrf_scores[d], reverse=True)
    ]


class HybridRetriever:
    """
    Accepts the existing ChromaVectorStore and a pre-fetched list of all document
    chunks at init time. BM25 index is built once over those chunks; the vector
    index wraps the same store. Both retrievers over-fetch by 2× before RRF merge.

    .get_relevant_documents(query) is compatible with LangChain retriever chains.
    """

    def __init__(
        self,
        vector_store: ChromaVectorStore,
        all_chunks: list[SourceChunk],
        embed_model: BaseEmbedding,
    ) -> None:
        self._all_chunks = all_chunks

        # Dense index — wraps the same ChromaVectorStore, built once
        self._index = VectorStoreIndex.from_vector_store(
            vector_store=vector_store,
            embed_model=embed_model,
        )

        # Sparse BM25 index over all chunk texts
        tokenized = [_tokenize(c["chunk"]) for c in all_chunks]
        self._bm25 = BM25Okapi(tokenized) if tokenized else None

    def get_relevant_documents(self, query: str, top_k: int = 5) -> list[SourceChunk]:
        """Return top_k SourceChunks fused from vector + BM25 via RRF."""
        n = top_k * 2

        vector_hits = self._vector_retrieve(query, n)
        bm25_hits = self._bm25_retrieve(query, n)

        return _rrf_merge([vector_hits, bm25_hits])[:top_k]

    # ------------------------------------------------------------------
    # Internal retrieval helpers
    # ------------------------------------------------------------------

    def _vector_retrieve(
        self, query: str, n: int
    ) -> list[tuple[str, SourceChunk]]:
        nodes = self._index.as_retriever(similarity_top_k=n).retrieve(query)
        return [
            (
                _doc_id(
                    node.node.metadata.get("file_path", ""),
                    node.get_content(),
                ),
                SourceChunk(
                    file_path=node.node.metadata.get("file_path", ""),
                    chunk=node.get_content(),
                    score=float(node.score) if node.score is not None else 0.0,
                ),
            )
            for node in nodes
        ]

    def _bm25_retrieve(
        self, query: str, n: int
    ) -> list[tuple[str, SourceChunk]]:
        if self._bm25 is None or not self._all_chunks:
            return []

        scores = self._bm25.get_scores(_tokenize(query))
        top_indices = sorted(
            range(len(scores)), key=lambda i: scores[i], reverse=True
        )[:n]

        return [
            (
                _doc_id(self._all_chunks[i]["file_path"], self._all_chunks[i]["chunk"]),
                SourceChunk(
                    file_path=self._all_chunks[i]["file_path"],
                    chunk=self._all_chunks[i]["chunk"],
                    score=float(scores[i]),
                ),
            )
            for i in top_indices
            if scores[i] > 0.0  # skip zero-score results
        ]


# ---------------------------------------------------------------------------
# Factory + drop-in function
# ---------------------------------------------------------------------------

def make_hybrid_retriever(repo_id: str) -> HybridRetriever:
    """
    Build a HybridRetriever for repo_id by fetching the full corpus from
    ChromaDB and constructing the BM25 + vector indices.
    """
    from backend.core.indexer import get_chroma_collection, get_embed_model

    collection = get_chroma_collection(repo_id)
    vector_store = ChromaVectorStore(chroma_collection=collection)

    result = collection.get(include=["documents", "metadatas"])
    all_chunks: list[SourceChunk] = [
        SourceChunk(
            file_path=(meta or {}).get("file_path", ""),
            chunk=text,
            score=0.0,
        )
        for text, meta in zip(
            result["documents"] or [], result["metadatas"] or []
        )
    ]

    return HybridRetriever(
        vector_store=vector_store,
        all_chunks=all_chunks,
        embed_model=get_embed_model(),
    )


def invalidate_cache(repo_id: str) -> None:
    """Remove the cached HybridRetriever for repo_id. Called after re-indexing."""
    _cache.pop(repo_id, None)


def hybrid_retrieve(repo_id: str, question: str, top_k: int = 5) -> list[SourceChunk]:
    """Drop-in replacement for core.retriever.retrieve using hybrid BM25 + vector search."""
    if repo_id not in _cache:
        _cache[repo_id] = make_hybrid_retriever(repo_id)
    return _cache[repo_id].get_relevant_documents(question, top_k)
