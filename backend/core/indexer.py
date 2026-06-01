"""
Indexer — reads a list of source file paths produced by the fetcher, splits
them into code chunks using LlamaIndex's CodeSplitter (tree-sitter backed),
embeds each chunk with HuggingFace bge-small-en-v1.5, and persists the
resulting vectors in a per-repo ChromaDB collection.

Skip logic: if a collection for repo_id already has documents, build_index
returns the existing count immediately without re-processing any files.
"""

import logging
import re
from collections import defaultdict
from dataclasses import asdict
from functools import lru_cache
from pathlib import Path

import chromadb
from llama_index.core import Document, StorageContext, VectorStoreIndex
from langchain_text_splitters import Language, RecursiveCharacterTextSplitter
from llama_index.core.schema import TextNode
from llama_index.core.embeddings import BaseEmbedding
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.vector_stores.chroma import ChromaVectorStore

from backend.config import get_settings
from backend.core.symbol_extractor import extract_symbols

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Maps file extension → tree-sitter language name used by _load_documents metadata.
_EXT_TO_LANG: dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".java": "java",
    ".go": "go",
}

# Maps file extension → LangChain Language enum for AST-aware splitting.
# Add entries here to support additional languages without touching split logic.
LANGUAGE_MAP: dict[str, Language] = {
    ".py": Language.PYTHON,
    ".js": Language.JS,
    ".jsx": Language.JS,
    ".ts": Language.TS,
    ".tsx": Language.TS,
    ".java": Language.JAVA,
    ".go": Language.GO,
}

# AST-aware splitter settings (character-based).
_CHUNK_SIZE = 1500
_CHUNK_OVERLAP = 200

# Fallback character splitter settings for extensions not in LANGUAGE_MAP.
_FALLBACK_CHUNK_SIZE = 512
_FALLBACK_CHUNK_OVERLAP = 64


# ---------------------------------------------------------------------------
# Helpers — cached singletons
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _get_chroma_client() -> chromadb.PersistentClient:
    """One persistent ChromaDB client per process, reused across calls."""
    path = str(get_settings().chroma_persist_dir)
    return chromadb.PersistentClient(path=path)


@lru_cache(maxsize=1)
def get_embed_model() -> BaseEmbedding:
    """Return a cached embed model: Ollama for short names, HuggingFace for 'org/model' paths."""
    model_name = get_settings().embedding_model
    logger.info("Loading embedding model '%s'…", model_name)
    if "/" in model_name:
        return HuggingFaceEmbedding(model_name=model_name)
    return OllamaEmbedding(model_name=model_name)

_get_embed_model = get_embed_model  # backward-compat alias


def _sanitize_name(repo_id: str) -> str:
    """
    Coerce repo_id into a valid ChromaDB collection name:
    3-63 chars, lowercase alphanumeric + hyphens, start/end alphanumeric.
    """
    name = re.sub(r"[^a-z0-9-]", "-", repo_id.lower())
    name = re.sub(r"-+", "-", name).strip("-")
    name = name[:63]
    # Pad names that are too short after stripping (edge case for very short ids).
    if len(name) < 3:
        name = f"r-{name}-x"
    return name


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_chroma_collection(repo_id: str) -> chromadb.Collection:
    """Return (or create) the ChromaDB collection scoped to repo_id."""
    return _get_chroma_client().get_or_create_collection(
        name=_sanitize_name(repo_id),
        metadata={"hnsw:space": "cosine"},
    )


def index_already_exists(repo_id: str) -> bool:
    """True when repo_id has at least one chunk already stored in ChromaDB."""
    try:
        return get_chroma_collection(repo_id).count() > 0
    except Exception:
        return False


def build_index(file_paths: list[Path], repo_id: str) -> int:
    """
    Chunk, embed, and store every file in file_paths under repo_id's
    ChromaDB collection.

    - Skips re-indexing if the collection already has documents.
    - Groups files by language so each group gets the right CodeSplitter.
    - Falls back to SentenceSplitter for any language tree-sitter can't parse.

    Returns the total number of chunks stored in ChromaDB.
    Raises ValueError when file_paths is empty or all files are unreadable.
    """
    if index_already_exists(repo_id):
        count = get_chroma_collection(repo_id).count()
        logger.info(
            "Repo '%s' already indexed (%d chunks) — skipping.", repo_id, count
        )
        return count

    if not file_paths:
        raise ValueError(f"No files provided to index for repo '{repo_id}'.")

    # 1. Load
    docs = _load_documents(file_paths)
    if not docs:
        raise ValueError(
            f"All files were empty or unreadable for repo '{repo_id}'."
        )
    logger.info("Loaded %d / %d files for '%s'.", len(docs), len(file_paths), repo_id)

    # 2. Chunk
    nodes = _chunk_documents(docs)
    logger.info("Produced %d chunks from %d documents.", len(nodes), len(docs))

    # 3. Embed + persist
    collection = get_chroma_collection(repo_id)
    vector_store = ChromaVectorStore(chroma_collection=collection)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    VectorStoreIndex(
        nodes=nodes,
        storage_context=storage_context,
        embed_model=_get_embed_model(),
        show_progress=False,
    )

    count = collection.count()
    logger.info("Stored %d chunks for repo '%s'.", count, repo_id)

    # 4. Extract + persist symbols (AST-based, best-effort)
    _index_symbols(file_paths, repo_id)

    return count


def _index_symbols(file_paths: list[Path], repo_id: str) -> None:
    from backend.persistence.symbol import delete_symbols, insert_symbols
    try:
        delete_symbols(repo_id)
        symbols = extract_symbols(file_paths)
        inserted = insert_symbols(repo_id, [asdict(s) for s in symbols])
        logger.info("Indexed %d symbols for repo '%s'.", inserted, repo_id)
    except Exception as exc:
        logger.warning("Symbol indexing failed for '%s': %s", repo_id, exc)


def delete_index(repo_id: str) -> None:
    """Drop the ChromaDB collection and symbol rows for repo_id."""
    from backend.core.hybrid_retriever import invalidate_cache as _invalidate_hybrid
    from backend.persistence.symbol import delete_symbols
    _invalidate_hybrid(repo_id)
    name = _sanitize_name(repo_id)
    try:
        _get_chroma_client().delete_collection(name)
        logger.info("Deleted collection '%s'.", name)
    except Exception as exc:
        logger.warning("Could not delete collection '%s': %s", name, exc)
    try:
        delete_symbols(repo_id)
    except Exception as exc:
        logger.warning("Could not delete symbols for '%s': %s", repo_id, exc)


# ---------------------------------------------------------------------------
# Internal — loading and chunking
# ---------------------------------------------------------------------------

def _load_documents(file_paths: list[Path]) -> list[Document]:
    """Read each file into a LlamaIndex Document, tagging language from extension."""
    docs: list[Document] = []
    for path in file_paths:
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            logger.warning("Skipping unreadable file %s: %s", path, exc)
            continue
        if not text.strip():
            continue
        docs.append(
            Document(
                text=text,
                doc_id=str(path),
                metadata={
                    "file_path": str(path),
                    "language": _EXT_TO_LANG.get(path.suffix, "text"),
                },
            )
        )
    return docs


def _chunk_documents(docs: list[Document]) -> list[TextNode]:
    """
    Group documents by their LangChain Language (derived from file extension),
    run each group through the appropriate splitter, and collect TextNodes.
    Documents whose extension is absent from LANGUAGE_MAP get None as the key
    and are processed by the character-based fallback splitter.
    """
    by_lang: dict[Language | None, list[Document]] = defaultdict(list)
    for doc in docs:
        lang = LANGUAGE_MAP.get(Path(doc.metadata["file_path"]).suffix)
        by_lang[lang].append(doc)

    all_nodes: list[TextNode] = []
    for lang, lang_docs in by_lang.items():
        all_nodes.extend(_split_group(lang, lang_docs))

    return all_nodes


def _split_group(lang: Language | None, docs: list[Document]) -> list[TextNode]:
    """
    Split a group of documents using RecursiveCharacterTextSplitter.

    Uses from_language() for known Language values (AST-aware separators).
    Falls back to plain character splitting when lang is None (unsupported
    extension) or if from_language() raises unexpectedly.
    """
    if lang is not None:
        try:
            splitter = RecursiveCharacterTextSplitter.from_language(
                language=lang,
                chunk_size=_CHUNK_SIZE,
                chunk_overlap=_CHUNK_OVERLAP,
            )
        except Exception as exc:
            logger.warning(
                "from_language failed for '%s' (%s); using character splitter.",
                lang,
                exc,
            )
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=_FALLBACK_CHUNK_SIZE,
                chunk_overlap=_FALLBACK_CHUNK_OVERLAP,
            )
    else:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=_FALLBACK_CHUNK_SIZE,
            chunk_overlap=_FALLBACK_CHUNK_OVERLAP,
        )

    nodes: list[TextNode] = []
    for doc in docs:
        for chunk in splitter.split_text(doc.text):
            nodes.append(TextNode(text=chunk, metadata=doc.metadata))
    return nodes
