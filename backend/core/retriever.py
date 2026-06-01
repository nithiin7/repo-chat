"""
Retriever — queries the ChromaDB vector store for a given repo_id and returns
the top-k most relevant code chunks for a user question.

Each retrieved child chunk's parent_id is used to fetch the full parent chunk
from SQLite, so the returned SourceChunk.chunk contains the wider context
(full function/class body) rather than the narrow child snippet.
"""

from typing import Optional, TypedDict

from llama_index.core import VectorStoreIndex
from llama_index.vector_stores.chroma import ChromaVectorStore

from backend.core.indexer import get_chroma_collection, get_embed_model


class SourceChunk(TypedDict):
    file_path: str
    chunk: str          # parent chunk text (wide context for LLM)
    score: float
    chunk_type: str     # function | class | method | module
    symbol_name: Optional[str]
    chunk_index: int
    parent_id: str


def retrieve(repo_id: str, question: str, top_k: int = 5) -> list[SourceChunk]:
    """
    Embed question, run similarity search against repo_id's collection,
    then expand each hit to its parent chunk for LLM context.
    """
    collection = get_chroma_collection(repo_id)
    vector_store = ChromaVectorStore(chroma_collection=collection)
    index = VectorStoreIndex.from_vector_store(
        vector_store=vector_store,
        embed_model=get_embed_model(),
    )
    nodes = index.as_retriever(similarity_top_k=top_k).retrieve(question)

    child_chunks: list[SourceChunk] = [
        SourceChunk(
            file_path=node.node.metadata.get("file_path", ""),
            chunk=node.get_content(),
            score=float(node.score) if node.score is not None else 0.0,
            chunk_type=node.node.metadata.get("chunk_type", "module"),
            symbol_name=node.node.metadata.get("symbol_name") or None,
            chunk_index=int(node.node.metadata.get("chunk_index", 0)),
            parent_id=node.node.metadata.get("parent_id", ""),
        )
        for node in nodes
    ]

    return _expand_to_parents(repo_id, child_chunks)


def _expand_to_parents(
    repo_id: str, child_chunks: list[SourceChunk]
) -> list[SourceChunk]:
    """
    Replace each child chunk's text with its parent chunk text.
    Deduplicates by parent_id so the LLM never sees the same context twice.
    Preserves the ordering and score of the first child hit per parent.
    """
    from backend.persistence.parent_chunk import get_parent_chunks_by_ids

    # Collect unique parent_ids in hit order
    seen_parents: dict[str, SourceChunk] = {}
    for chunk in child_chunks:
        pid = chunk["parent_id"]
        if pid and pid not in seen_parents:
            seen_parents[pid] = chunk

    if not seen_parents:
        return child_chunks

    parent_rows = get_parent_chunks_by_ids(repo_id, list(seen_parents.keys()))
    parent_text_by_id = {row.id: row.text for row in parent_rows}

    result: list[SourceChunk] = []
    for pid, chunk in seen_parents.items():
        parent_text = parent_text_by_id.get(pid)
        result.append(
            SourceChunk(
                file_path=chunk["file_path"],
                chunk=parent_text if parent_text is not None else chunk["chunk"],
                score=chunk["score"],
                chunk_type=chunk["chunk_type"],
                symbol_name=chunk["symbol_name"],
                chunk_index=chunk["chunk_index"],
                parent_id=pid,
            )
        )

    return result
