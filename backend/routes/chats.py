import asyncio
import json
import logging
from collections.abc import AsyncGenerator

from backend.config import get_settings
from backend.core.diff_fetcher import format_diff_for_prompt
from backend.core.hybrid_retriever import hybrid_retrieve
from backend.core.llm import (
    _MULTI_REPO_SYSTEM_PROMPT,
    LLMError,
    TokenUsage,
    generate_suggestions,
    stream_answer,
)
from backend.core.reranker import get_reranker
from backend.core.retriever import SourceChunk
from backend.persistence import (
    delete_chat as db_delete_chat,
)
from backend.persistence import (
    fork_chat,
    get_chat,
    get_diff,
    get_repo,
    list_messages,
    pin_chat,
    save_message,
    set_chat_title_if_default,
)
from backend.persistence import (
    rename_chat as db_rename_chat,
)
from backend.schemas import (
    ChatInfo,
    ChatMessageInfo,
    ChatRequest,
    ForkChatRequest,
    PinChatRequest,
    RenameChatRequest,
)
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter()


def _build_multi_repo_context(
    all_chunks: list[SourceChunk],
    repo_ids: list[str],
    repo_names: dict[str, str],
) -> list[str]:
    """Group retrieved chunks by repo into labeled context strings for the LLM."""
    by_repo: dict[str, list[str]] = {rid: [] for rid in repo_ids}
    for chunk in all_chunks:
        rid = chunk.get("repo_id", repo_ids[0])  # type: ignore[arg-type]
        if rid in by_repo:
            by_repo[rid].append(chunk["chunk"])
    result = []
    for rid in repo_ids:
        chunks = by_repo.get(rid, [])
        if chunks:
            name = repo_names.get(rid, rid)
            block = f"=== Repository: {name} ===\n\n" + "\n\n---\n\n".join(chunks)
            result.append(block)
    return result


@router.post("/chat")
async def chat(body: ChatRequest):
    is_multi_repo = bool(body.repo_ids and len(body.repo_ids) >= 2)

    if is_multi_repo:
        repos_data = await asyncio.gather(
            *[asyncio.to_thread(get_repo, rid) for rid in body.repo_ids],  # type: ignore[union-attr]
            return_exceptions=True,
        )
        errored = [
            body.repo_ids[i]  # type: ignore[index]
            for i, r in enumerate(repos_data)
            if isinstance(r, BaseException)
        ]
        if errored:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to look up repos: {', '.join(errored)}",
            )
        missing = [body.repo_ids[i] for i, r in enumerate(repos_data) if not r]  # type: ignore[index]
        if missing:
            raise HTTPException(
                status_code=404,
                detail=f"Repos not indexed: {', '.join(missing)}. Call POST /index first.",
            )
        repo_names: dict[str, str] = {
            r["repo_id"]: (r["name"] or r["repo_id"]) for r in repos_data if r
        }
    else:
        if not body.repo_id:
            raise HTTPException(
                status_code=400, detail="Either repo_id or repo_ids (2+) must be provided."
            )
        repo = await asyncio.to_thread(get_repo, body.repo_id)
        if not repo:
            raise HTTPException(
                status_code=404,
                detail=f"Repo '{body.repo_id}' not indexed. Call POST /index first.",
            )

    history: list[dict[str, str]] = []
    if body.chat_id and not is_multi_repo:
        raw = await asyncio.to_thread(list_messages, body.chat_id)
        history = [{"role": m["role"], "content": m["content"]} for m in raw]
        await asyncio.to_thread(save_message, body.chat_id, "user", body.question)
        await asyncio.to_thread(set_chat_title_if_default, body.chat_id, body.question)

    diff_context: str | None = None
    if body.diff_id and not is_multi_repo:
        diff = await asyncio.to_thread(get_diff, body.diff_id)
        if diff:
            diff_context = format_diff_for_prompt(diff)

    async def event_stream() -> AsyncGenerator[str, None]:
        accumulated: list[str] = []
        saved_sources: list | None = None
        had_error = False
        repo_id_for_log = (
            ",".join(body.repo_ids)
            if is_multi_repo and body.repo_ids
            else (body.repo_id or "unknown")
        )
        try:
            if is_multi_repo:
                retrieve_results = await asyncio.gather(
                    *[
                        asyncio.to_thread(hybrid_retrieve, rid, body.question, 4, None)
                        for rid in body.repo_ids  # type: ignore[union-attr]
                    ],
                    return_exceptions=True,
                )
                retrieve_results = [
                    r if not isinstance(r, BaseException) else [] for r in retrieve_results
                ]
                source_chunks: list[SourceChunk] = []
                for rid, chunks in zip(body.repo_ids, retrieve_results, strict=True):  # type: ignore[union-attr]
                    for chunk in chunks:
                        tagged = dict(chunk)
                        tagged["repo_id"] = rid
                        tagged["repo_name"] = repo_names.get(rid, rid)
                        source_chunks.append(tagged)  # type: ignore[arg-type]
                text_chunks = _build_multi_repo_context(source_chunks, body.repo_ids, repo_names)  # type: ignore[arg-type]
            else:
                source_chunks = await asyncio.to_thread(
                    hybrid_retrieve,
                    body.repo_id,
                    body.question,
                    5,
                    body.scope_paths,  # type: ignore[arg-type]
                )
                if get_settings().use_reranker:
                    source_chunks = await asyncio.to_thread(
                        get_reranker().rerank, body.question, source_chunks
                    )
                text_chunks = [sc["chunk"] for sc in source_chunks]

            saved_sources = source_chunks
            yield f"event: sources\ndata: {json.dumps(source_chunks)}\n\n"

            async for item in stream_answer(
                body.question,
                text_chunks,
                body.mode,
                history,
                diff_context,
                system_prompt=_MULTI_REPO_SYSTEM_PROMPT if is_multi_repo else None,
            ):
                if isinstance(item, TokenUsage):
                    yield f"event: usage\ndata: {json.dumps(item.to_dict())}\n\n"
                else:
                    accumulated.append(item)
                    yield f"data: {json.dumps(item)}\n\n"

        except LLMError as exc:
            had_error = True
            logger.warning("LLM error for repo '%s': %s", repo_id_for_log, exc)
            yield f"data: [ERROR] {exc}\n\n"
        except Exception:
            had_error = True
            logger.exception("Unexpected error in /chat for repo '%s'", repo_id_for_log)
            yield "data: [ERROR] Internal server error.\n\n"
        finally:
            if body.chat_id and not is_multi_repo and accumulated:
                full_response = "".join(accumulated)
                await asyncio.to_thread(
                    save_message,
                    body.chat_id,
                    "assistant",
                    full_response,
                    saved_sources,
                )
            if not had_error and accumulated:
                yield "data: [CONTENT_DONE]\n\n"
                if get_settings().suggest_related_questions:
                    suggestions = await generate_suggestions(
                        body.question, "".join(accumulated), body.mode
                    )
                    if suggestions:
                        yield f"event: suggestions\ndata: {json.dumps(suggestions)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/chats/{chat_id}/fork", response_model=ChatInfo)
async def fork_chat_endpoint(chat_id: str, body: ForkChatRequest):
    chat = await asyncio.to_thread(get_chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail=f"Chat '{chat_id}' not found.")
    new_chat = await asyncio.to_thread(fork_chat, chat_id, body.before_message_id)
    if not new_chat:
        raise HTTPException(status_code=500, detail="Fork failed.")
    return ChatInfo(**new_chat)


@router.patch("/chats/{chat_id}/pin", response_model=ChatInfo)
async def toggle_pin_chat(chat_id: str, body: PinChatRequest):
    chat = await asyncio.to_thread(get_chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail=f"Chat '{chat_id}' not found.")
    await asyncio.to_thread(pin_chat, chat_id, body.is_pinned)
    updated = await asyncio.to_thread(get_chat, chat_id)
    return ChatInfo(**updated)


@router.patch("/chats/{chat_id}", response_model=ChatInfo)
async def rename_chat(chat_id: str, body: RenameChatRequest):
    chat = await asyncio.to_thread(get_chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail=f"Chat '{chat_id}' not found.")
    await asyncio.to_thread(db_rename_chat, chat_id, body.title)
    updated = await asyncio.to_thread(get_chat, chat_id)
    return ChatInfo(**updated)


@router.delete("/chats/{chat_id}")
async def delete_chat(chat_id: str):
    chat = await asyncio.to_thread(get_chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail=f"Chat '{chat_id}' not found.")
    await asyncio.to_thread(db_delete_chat, chat_id)
    return {"status": "deleted", "chat_id": chat_id}


@router.get("/chats/{chat_id}/messages", response_model=list[ChatMessageInfo])
async def get_chat_messages(chat_id: str):
    chat = await asyncio.to_thread(get_chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail=f"Chat '{chat_id}' not found.")
    messages = await asyncio.to_thread(list_messages, chat_id)
    return [ChatMessageInfo(**m) for m in messages]
