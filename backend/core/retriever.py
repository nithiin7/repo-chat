"""
Retriever — queries the ChromaDB vector store for a given repo_id and returns
the top-k most relevant code chunks for a user question.
"""

from typing import List

import chromadb
from llama_index.core import VectorStoreIndex
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.vector_stores.chroma import ChromaVectorStore

from backend.config import get_settings
from backend.core.indexer import get_chroma_collection


def retrieve(repo_id: str, question: str, top_k: int = 5) -> List[str]:
    """
    Embed question, run similarity search against repo_id's collection,
    and return a list of relevant code chunk strings.
    """
    ...
