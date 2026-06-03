"""
HybridRetriever — fuses dense vector search (ChromaDB/LlamaIndex) with sparse
BM25 keyword search using Reciprocal Rank Fusion (RRF, k=60).

After RRF merge, each child chunk is expanded to its parent chunk (SQLite
lookup by parent_id) so the LLM receives full function/class context while
retrieval precision stays high (small child embeddings).

One HybridRetriever is built per repo_id and cached in _cache. The expensive
parts (corpus fetch, BM25 build, VectorStoreIndex init) run once; top_k is
passed per query so the same cached instance serves all call sites.
Call invalidate_cache(repo_id) after re-indexing to force a rebuild.
"""

import re
from typing import Optional

from llama_index.core import VectorStoreIndex
from llama_index.core.embeddings import BaseEmbedding
from llama_index.vector_stores.chroma import ChromaVectorStore
from rank_bm25 import BM25Okapi

from backend.core.retriever import SourceChunk, _expand_to_parents

_cache: dict[str, "HybridRetriever"] = {}


def _matches_scope(file_path: str, scope_paths: list[str]) -> bool:
    """Return True if file_path falls within any of the given relative scope paths."""
    for scope in scope_paths:
        scope = scope.rstrip("/")
        # Exact file match: absolute path ends with /relative/path
        if file_path.endswith("/" + scope):
            return True
        # Folder match: absolute path contains /scope/ as a directory segment
        if ("/" + scope + "/") in file_path:
            return True
    return False


def _tokenize(text: str) -> list[str]:
    return re.findall(r"\w+", text.lower())


def _doc_id(file_path: str, chunk: str) -> str:
    """Stable dedup key — uses child chunk text (pre-parent-expansion)."""
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
            chunk_type=chunks[did]["chunk_type"],
            symbol_name=chunks[did]["symbol_name"],
            chunk_index=chunks[did]["chunk_index"],
            parent_id=chunks[did]["parent_id"],
        )
        for did in sorted(rrf_scores, key=lambda d: rrf_scores[d], reverse=True)
    ]


class HybridRetriever:
    """
    Accepts the existing ChromaVectorStore and a pre-fetched list of all child
    chunks at init time. BM25 index is built once over those chunks; the vector
    index wraps the same store. Both retrievers over-fetch by 2× before RRF
    merge. After merge, child chunks are expanded to parent chunks.

    .get_relevant_documents(query) is compatible with LangChain retriever chains.
    """

    def __init__(
        self,
        repo_id: str,
        vector_store: ChromaVectorStore,
        all_chunks: list[SourceChunk],
        embed_model: BaseEmbedding,
    ) -> None:
        self._repo_id = repo_id
        self._all_chunks = all_chunks

        self._index = VectorStoreIndex.from_vector_store(
            vector_store=vector_store,
            embed_model=embed_model,
        )

        tokenized = [_tokenize(c["chunk"]) for c in all_chunks]
        self._bm25 = BM25Okapi(tokenized) if tokenized else None

    def get_relevant_documents(
        self, query: str, top_k: int = 5, scope_paths: Optional[list[str]] = None
    ) -> list[SourceChunk]:
        """Return top_k SourceChunks fused from vector + BM25 via RRF, expanded to parents."""
        # Over-fetch when scoping so filtering doesn't starve results
        n = top_k * (3 if scope_paths else 2)

        vector_hits = self._vector_retrieve(query, n, scope_paths)
        bm25_hits = self._bm25_retrieve(query, n, scope_paths)

        merged = _rrf_merge([vector_hits, bm25_hits])[:top_k]
        return _expand_to_parents(self._repo_id, merged)

    # ------------------------------------------------------------------

    def _vector_retrieve(
        self, query: str, n: int, scope_paths: Optional[list[str]] = None
    ) -> list[tuple[str, SourceChunk]]:
        nodes = self._index.as_retriever(similarity_top_k=n).retrieve(query)
        results = []
        for node in nodes:
            fp = node.node.metadata.get("file_path", "")
            if scope_paths and not _matches_scope(fp, scope_paths):
                continue
            results.append((
                _doc_id(fp, node.get_content()),
                SourceChunk(
                    file_path=fp,
                    chunk=node.get_content(),
                    score=float(node.score) if node.score is not None else 0.0,
                    chunk_type=node.node.metadata.get("chunk_type", "module"),
                    symbol_name=node.node.metadata.get("symbol_name") or None,
                    chunk_index=int(node.node.metadata.get("chunk_index", 0)),
                    parent_id=node.node.metadata.get("parent_id", ""),
                ),
            ))
        return results

    def _bm25_retrieve(
        self, query: str, n: int, scope_paths: Optional[list[str]] = None
    ) -> list[tuple[str, SourceChunk]]:
        if self._bm25 is None or not self._all_chunks:
            return []

        chunks = self._all_chunks
        if scope_paths:
            chunks = [c for c in chunks if _matches_scope(c["file_path"], scope_paths)]
        if not chunks:
            return []

        # Re-score only the in-scope subset
        tokenized = [_tokenize(c["chunk"]) for c in chunks]
        bm25 = BM25Okapi(tokenized)
        scores = bm25.get_scores(_tokenize(query))

        top_indices = sorted(
            range(len(scores)), key=lambda i: scores[i], reverse=True
        )[:n]

        return [
            (
                _doc_id(chunks[i]["file_path"], chunks[i]["chunk"]),
                SourceChunk(
                    file_path=chunks[i]["file_path"],
                    chunk=chunks[i]["chunk"],
                    score=float(scores[i]),
                    chunk_type=chunks[i]["chunk_type"],
                    symbol_name=chunks[i]["symbol_name"],
                    chunk_index=chunks[i]["chunk_index"],
                    parent_id=chunks[i]["parent_id"],
                ),
            )
            for i in top_indices
            if scores[i] > 0.0
        ]


# ---------------------------------------------------------------------------
# Factory + drop-in function
# ---------------------------------------------------------------------------

def make_hybrid_retriever(repo_id: str) -> HybridRetriever:
    """
    Build a HybridRetriever for repo_id by fetching the full child-chunk corpus
    from ChromaDB and constructing the BM25 + vector indices.
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
            chunk_type=(meta or {}).get("chunk_type", "module"),
            symbol_name=(meta or {}).get("symbol_name") or None,
            chunk_index=int((meta or {}).get("chunk_index", 0)),
            parent_id=(meta or {}).get("parent_id", ""),
        )
        for text, meta in zip(
            result["documents"] or [], result["metadatas"] or []
        )
    ]

    return HybridRetriever(
        repo_id=repo_id,
        vector_store=vector_store,
        all_chunks=all_chunks,
        embed_model=get_embed_model(),
    )


def invalidate_cache(repo_id: str) -> None:
    _cache.pop(repo_id, None)


def hybrid_retrieve(
    repo_id: str,
    question: str,
    top_k: int = 5,
    scope_paths: Optional[list[str]] = None,
) -> list[SourceChunk]:
    """Drop-in replacement for core.retriever.retrieve using hybrid BM25 + vector search."""
    if repo_id not in _cache:
        _cache[repo_id] = make_hybrid_retriever(repo_id)
    return _cache[repo_id].get_relevant_documents(question, top_k, scope_paths)
