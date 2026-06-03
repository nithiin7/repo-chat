"""
Indexer — reads a list of source file paths produced by the fetcher, splits
them into code chunks using LangChain's RecursiveCharacterTextSplitter (AST-
aware separators), embeds each child chunk with the configured embedding model,
and persists the resulting vectors in a per-repo ChromaDB collection.

Two-pass chunking strategy
--------------------------
Each file is first split into *parent* chunks (~4096 chars / ~1024 tokens).
Each parent is then split into *child* chunks (~1024 chars / ~256 tokens).
Only child chunks are embedded and stored in ChromaDB; the parent chunks are
saved to SQLite and fetched at query time so the LLM receives full
function/class context.

Metadata on every child chunk (TextNode)
-----------------------------------------
  file_path   : absolute path to the source file
  language    : python | javascript | typescript | java | go | text
  chunk_type  : function | class | method | module
  symbol_name : enclosing symbol name, or None
  chunk_index : sequential index within the file (0-based)
  parent_id   : UUID of the parent chunk stored in SQLite

Skip logic: if a collection for repo_id already has documents, build_index
returns the existing count immediately without re-processing any files.
"""

import logging
import re
import uuid
from collections import defaultdict
from dataclasses import asdict
from functools import lru_cache
from pathlib import Path
from typing import Callable, Optional

import chromadb
from llama_index.core import Document, StorageContext, VectorStoreIndex
from langchain_text_splitters import Language, RecursiveCharacterTextSplitter
from llama_index.core.schema import TextNode
from llama_index.core.embeddings import BaseEmbedding
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.vector_stores.chroma import ChromaVectorStore

from backend.config import get_settings
from backend.core.symbol_extractor import ExtractedSymbol, extract_symbols

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_EXT_TO_LANG: dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".java": "java",
    ".go": "go",
}

LANGUAGE_MAP: dict[str, Language] = {
    ".py": Language.PYTHON,
    ".js": Language.JS,
    ".jsx": Language.JS,
    ".ts": Language.TS,
    ".tsx": Language.TS,
    ".java": Language.JAVA,
    ".go": Language.GO,
}

# Parent chunks — stored in SQLite, returned to LLM (~1024 tokens)
_PARENT_CHUNK_SIZE = 4096
_PARENT_CHUNK_OVERLAP = 256

# Child chunks — embedded in ChromaDB, used for retrieval (~256 tokens)
_CHILD_CHUNK_SIZE = 1024
_CHILD_CHUNK_OVERLAP = 128

# Fallback sizes for extensions not in LANGUAGE_MAP
_FALLBACK_PARENT_SIZE = 2048
_FALLBACK_PARENT_OVERLAP = 128
_FALLBACK_CHILD_SIZE = 512
_FALLBACK_CHILD_OVERLAP = 64


# ---------------------------------------------------------------------------
# Helpers — cached singletons
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _get_chroma_client() -> chromadb.PersistentClient:
    path = str(get_settings().chroma_persist_dir)
    return chromadb.PersistentClient(path=path)


@lru_cache(maxsize=1)
def get_embed_model() -> BaseEmbedding:
    model_name = get_settings().embedding_model
    logger.info("Loading embedding model '%s'…", model_name)
    if "/" in model_name:
        return HuggingFaceEmbedding(model_name=model_name)
    return OllamaEmbedding(model_name=model_name)

_get_embed_model = get_embed_model  # backward-compat alias


def _sanitize_name(repo_id: str) -> str:
    name = re.sub(r"[^a-z0-9-]", "-", repo_id.lower())
    name = re.sub(r"-+", "-", name).strip("-")
    name = name[:63]
    if len(name) < 3:
        name = f"r-{name}-x"
    return name


def _make_splitter(
    lang: Optional[Language],
    chunk_size: int,
    chunk_overlap: int,
    fallback_size: int,
    fallback_overlap: int,
) -> RecursiveCharacterTextSplitter:
    if lang is not None:
        try:
            return RecursiveCharacterTextSplitter.from_language(
                language=lang,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                add_start_index=True,
            )
        except Exception as exc:
            logger.warning("from_language failed for '%s' (%s); using fallback.", lang, exc)
    return RecursiveCharacterTextSplitter(
        chunk_size=fallback_size,
        chunk_overlap=fallback_overlap,
        add_start_index=True,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_chroma_collection(repo_id: str) -> chromadb.Collection:
    return _get_chroma_client().get_or_create_collection(
        name=_sanitize_name(repo_id),
        metadata={"hnsw:space": "cosine"},
    )


def index_already_exists(repo_id: str) -> bool:
    try:
        return get_chroma_collection(repo_id).count() > 0
    except Exception:
        return False


def build_index(
    file_paths: list[Path],
    repo_id: str,
    progress_callback: Callable[[int, int, str], None] | None = None,
) -> int:
    """
    Chunk, embed, and store every file in file_paths under repo_id's
    ChromaDB collection. Parent chunks are saved to SQLite.

    Returns the total number of child chunks stored in ChromaDB.
    Raises ValueError when file_paths is empty or all files are unreadable.
    """
    if index_already_exists(repo_id):
        count = get_chroma_collection(repo_id).count()
        logger.info("Repo '%s' already indexed (%d chunks) — skipping.", repo_id, count)
        return count

    if not file_paths:
        raise ValueError(f"No files provided to index for repo '{repo_id}'.")

    docs = _load_documents(file_paths, progress_callback)
    if not docs:
        raise ValueError(f"All files were empty or unreadable for repo '{repo_id}'.")
    logger.info("Loaded %d / %d files for '%s'.", len(docs), len(file_paths), repo_id)

    child_nodes, parent_dicts = _build_chunks(docs)
    logger.info(
        "Produced %d parent + %d child chunks from %d documents.",
        len(parent_dicts), len(child_nodes), len(docs),
    )

    # Persist parent chunks to SQLite first
    from backend.persistence.parent_chunk import save_parent_chunks
    save_parent_chunks(repo_id, parent_dicts)

    # Embed child chunks and store in ChromaDB
    collection = get_chroma_collection(repo_id)
    vector_store = ChromaVectorStore(chroma_collection=collection)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    VectorStoreIndex(
        nodes=child_nodes,
        storage_context=storage_context,
        embed_model=_get_embed_model(),
        show_progress=False,
    )

    count = collection.count()
    logger.info("Stored %d child chunks for repo '%s'.", count, repo_id)

    from backend.core.hybrid_retriever import invalidate_cache as _invalidate_hybrid
    _invalidate_hybrid(repo_id)

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


def _delete_chunks_for_files(collection: chromadb.Collection, file_paths: list[str]) -> None:
    if not file_paths:
        return
    try:
        collection.delete(where={"file_path": {"$in": file_paths}})
        logger.info("Deleted ChromaDB chunks for %d file(s).", len(file_paths))
    except Exception as exc:
        logger.warning("Failed to delete chunks for files: %s", exc)


def sync_index(
    changed_files: list[Path],
    deleted_file_paths: list[str],
    repo_id: str,
    progress_callback: Callable[[int, int, str], None] | None = None,
) -> tuple[int, int]:
    """
    Incrementally update the index:
    - Remove ChromaDB + SQLite entries for changed and deleted files
    - Re-embed changed files only
    Returns (child_chunks_added, files_reindexed).
    """
    from backend.persistence.parent_chunk import delete_parent_chunks_for_files, save_parent_chunks
    from backend.persistence.symbol import delete_symbols_for_files, insert_symbols

    all_affected = [str(p) for p in changed_files] + deleted_file_paths
    if all_affected:
        collection = get_chroma_collection(repo_id)
        _delete_chunks_for_files(collection, all_affected)
        delete_parent_chunks_for_files(repo_id, all_affected)
        delete_symbols_for_files(repo_id, all_affected)

    from backend.core.hybrid_retriever import invalidate_cache as _invalidate_hybrid
    _invalidate_hybrid(repo_id)

    if not changed_files:
        return 0, 0

    docs = _load_documents(changed_files, progress_callback)
    if not docs:
        return 0, len(changed_files)

    child_nodes, parent_dicts = _build_chunks(docs)

    save_parent_chunks(repo_id, parent_dicts)

    collection = get_chroma_collection(repo_id)
    vector_store = ChromaVectorStore(chroma_collection=collection)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    VectorStoreIndex(
        nodes=child_nodes,
        storage_context=storage_context,
        embed_model=_get_embed_model(),
        show_progress=False,
    )

    try:
        symbols = extract_symbols(changed_files)
        inserted = insert_symbols(repo_id, [asdict(s) for s in symbols])
        logger.info("Synced %d symbols for %d file(s) in repo '%s'.", inserted, len(changed_files), repo_id)
    except Exception as exc:
        logger.warning("Symbol sync failed for '%s': %s", repo_id, exc)

    logger.info(
        "Sync complete for repo '%s': %d child chunks added for %d file(s).",
        repo_id, len(child_nodes), len(changed_files),
    )
    return len(child_nodes), len(changed_files)


def delete_index(repo_id: str) -> None:
    """Drop the ChromaDB collection, parent chunks, and symbol rows for repo_id."""
    from backend.core.hybrid_retriever import invalidate_cache as _invalidate_hybrid
    from backend.persistence.parent_chunk import delete_parent_chunks
    from backend.persistence.symbol import delete_symbols

    _invalidate_hybrid(repo_id)
    name = _sanitize_name(repo_id)
    try:
        _get_chroma_client().delete_collection(name)
        logger.info("Deleted collection '%s'.", name)
    except Exception as exc:
        logger.warning("Could not delete collection '%s': %s", name, exc)
    try:
        delete_parent_chunks(repo_id)
    except Exception as exc:
        logger.warning("Could not delete parent chunks for '%s': %s", repo_id, exc)
    try:
        delete_symbols(repo_id)
    except Exception as exc:
        logger.warning("Could not delete symbols for '%s': %s", repo_id, exc)


# ---------------------------------------------------------------------------
# Internal — loading
# ---------------------------------------------------------------------------

def _load_documents(
    file_paths: list[Path],
    progress_callback: Callable[[int, int, str], None] | None = None,
) -> list[Document]:
    docs: list[Document] = []
    total = len(file_paths)
    for i, path in enumerate(file_paths):
        if progress_callback:
            progress_callback(i + 1, total, path.name)
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


# ---------------------------------------------------------------------------
# Internal — two-pass chunking with metadata enrichment
# ---------------------------------------------------------------------------

def _build_chunks(
    docs: list[Document],
) -> tuple[list[TextNode], list[dict]]:
    """
    Two-pass split: parent chunks (~4096 chars) → child chunks (~1024 chars).
    Returns (child_nodes_for_chroma, parent_dicts_for_sqlite).
    """
    # Group by language so each group uses the right splitter
    by_lang: dict[Language | None, list[Document]] = defaultdict(list)
    for doc in docs:
        lang = LANGUAGE_MAP.get(Path(doc.metadata["file_path"]).suffix)
        by_lang[lang].append(doc)

    all_child_nodes: list[TextNode] = []
    all_parent_dicts: list[dict] = []

    for lang, lang_docs in by_lang.items():
        parent_splitter = _make_splitter(
            lang,
            _PARENT_CHUNK_SIZE, _PARENT_CHUNK_OVERLAP,
            _FALLBACK_PARENT_SIZE, _FALLBACK_PARENT_OVERLAP,
        )
        child_splitter = _make_splitter(
            lang,
            _CHILD_CHUNK_SIZE, _CHILD_CHUNK_OVERLAP,
            _FALLBACK_CHILD_SIZE, _FALLBACK_CHILD_OVERLAP,
        )

        for doc in lang_docs:
            child_nodes, parent_dicts = _split_doc(
                doc, parent_splitter, child_splitter
            )
            all_child_nodes.extend(child_nodes)
            all_parent_dicts.extend(parent_dicts)

    return all_child_nodes, all_parent_dicts


def _split_doc(
    doc: Document,
    parent_splitter: RecursiveCharacterTextSplitter,
    child_splitter: RecursiveCharacterTextSplitter,
) -> tuple[list[TextNode], list[dict]]:
    """
    Split one document into parent chunks, then split each parent into children.
    Enriches every chunk with chunk_type, symbol_name, chunk_index, parent_id.
    """
    file_path = doc.metadata["file_path"]
    language = doc.metadata["language"]
    source_text = doc.text
    source_lines = source_text.splitlines()

    # Extract symbols once per file for metadata tagging
    symbols = _extract_symbols_for_file(Path(file_path), source_text)

    parent_lc_docs = parent_splitter.create_documents([source_text])

    child_nodes: list[TextNode] = []
    parent_dicts: list[dict] = []
    chunk_index = 0  # global counter per file, shared across parents

    for p_idx, p_doc in enumerate(parent_lc_docs):
        parent_id = str(uuid.uuid4())
        p_text = p_doc.page_content
        p_start_char = p_doc.metadata.get("start_index", 0)

        p_line = _char_to_line(source_text, p_start_char)
        p_chunk_type, p_symbol_name = _match_symbol(p_line, symbols)

        parent_dicts.append({
            "id": parent_id,
            "file_path": file_path,
            "text": p_text,
            "chunk_index": p_idx,
            "language": language,
            "chunk_type": p_chunk_type,
            "symbol_name": p_symbol_name,
        })

        child_lc_docs = child_splitter.create_documents([p_text])
        for c_doc in child_lc_docs:
            c_text = c_doc.page_content
            # start_index is relative to the parent chunk text
            c_start_in_parent = c_doc.metadata.get("start_index", 0)
            c_start_char = p_start_char + c_start_in_parent
            c_line = _char_to_line(source_text, c_start_char)
            c_chunk_type, c_symbol_name = _match_symbol(c_line, symbols)

            child_nodes.append(
                TextNode(
                    text=c_text,
                    metadata={
                        "file_path": file_path,
                        "language": language,
                        "chunk_type": c_chunk_type,
                        "symbol_name": c_symbol_name or "",
                        "chunk_index": chunk_index,
                        "parent_id": parent_id,
                    },
                )
            )
            chunk_index += 1

    return child_nodes, parent_dicts


def _char_to_line(text: str, char_offset: int) -> int:
    """Convert a character offset to a 1-indexed line number."""
    return text[:char_offset].count("\n") + 1


def _match_symbol(
    line: int, symbols: list[ExtractedSymbol]
) -> tuple[str, Optional[str]]:
    """
    Return (chunk_type, symbol_name) for the symbol whose line range contains
    `line`. When multiple symbols overlap, prefer the innermost (shortest range).
    Falls back to ("module", None) if no symbol covers the line.
    """
    best: Optional[ExtractedSymbol] = None
    for sym in symbols:
        if sym.start_line <= line <= sym.end_line:
            if best is None or (sym.end_line - sym.start_line) < (best.end_line - best.start_line):
                best = sym
    if best is None:
        return "module", None
    return best.kind, best.name


def _extract_symbols_for_file(
    path: Path, source: str
) -> list[ExtractedSymbol]:
    """Extract symbols from a single file's already-loaded source text."""
    from backend.core.symbol_extractor import _EXT_TO_LANG as _SYM_EXT_LANG
    from backend.core.symbol_extractor import _extract_python, _extract_regex

    lang = _SYM_EXT_LANG.get(path.suffix)
    if lang is None:
        return []
    try:
        if lang == "python":
            return _extract_python(source, str(path))
        return _extract_regex(source, str(path), lang)
    except Exception as exc:
        logger.debug("Symbol extraction failed for %s: %s", path, exc)
        return []
