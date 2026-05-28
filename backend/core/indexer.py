"""
Indexer — walks a local repo directory, splits code files with LlamaIndex's
CodeSplitter, generates embeddings via HuggingFace bge-small-en-v1.5, and
persists the resulting vector store in ChromaDB keyed by repo_id.
"""

from pathlib import Path

import chromadb
from chromadb.config import Settings as ChromaSettings
from llama_index.core import SimpleDirectoryReader, VectorStoreIndex
from llama_index.core.node_parser import CodeSplitter
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.vector_stores.chroma import ChromaVectorStore

from backend.config import get_settings


def get_chroma_collection(repo_id: str) -> chromadb.Collection:
    """Return (or create) a ChromaDB collection scoped to repo_id."""
    ...


def build_index(repo_path: Path, repo_id: str) -> int:
    """
    Read all source files under repo_path, chunk them, embed them,
    and upsert into ChromaDB.  Returns the number of indexed documents.
    """
    ...


def delete_index(repo_id: str) -> None:
    """Drop the ChromaDB collection for repo_id."""
    ...
