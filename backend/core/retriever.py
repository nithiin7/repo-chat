"""
Retriever — queries the ChromaDB vector store for a given repo_id and returns
the top-k most relevant code chunks for a user question.
"""

from typing import TypedDict

from llama_index.core import VectorStoreIndex
from llama_index.vector_stores.chroma import ChromaVectorStore

from backend.core.indexer import get_chroma_collection, get_embed_model


class SourceChunk(TypedDict):
    file_path: str
    chunk: str
    score: float


def retrieve(repo_id: str, question: str, top_k: int = 5) -> list[SourceChunk]:
    """
    Embed question, run similarity search against repo_id's collection,
    and return the top-k chunks with their file path and similarity score.
    """
    collection = get_chroma_collection(repo_id)
    vector_store = ChromaVectorStore(chroma_collection=collection)
    index = VectorStoreIndex.from_vector_store(
        vector_store=vector_store,
        embed_model=get_embed_model(),
    )
    nodes = index.as_retriever(similarity_top_k=top_k).retrieve(question)
    return [
        SourceChunk(
            file_path=node.node.metadata.get("file_path", ""),
            chunk=node.get_content(),
            score=float(node.score) if node.score is not None else 0.0,
        )
        for node in nodes
    ]
