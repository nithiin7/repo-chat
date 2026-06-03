import asyncio
import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.config import get_settings
from backend.core.diff_fetcher import format_diff_for_prompt
from backend.core.llm import LLMError, TokenUsage, generate_suggestions, stream_answer
from backend.core.hybrid_retriever import hybrid_retrieve
from backend.core.reranker import get_reranker
from backend.core.retriever import SourceChunk
from backend.persistence import (
    delete_chat,
    fork_chat,
    get_chat,
    get_diff,
    get_repo,
    list_messages,
    pin_chat,
    rename_chat,
    save_message,
    set_chat_title_if_default,
)
from backend.schemas import ChatInfo, ChatMessageInfo, ChatRequest, ForkChatRequest, PinChatRequest, RenameChatRequest

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/chat")
async def chat(body: ChatRequest):
    repo = await asyncio.to_thread(get_repo, body.repo_id)
    if not repo:
        raise HTTPException(
            status_code=404,
            detail=f"Repo '{body.repo_id}' not indexed. Call POST /index first.",
        )

    history: list[dict[str, str]] = []
    if body.chat_id:
        raw = await asyncio.to_thread(list_messages, body.chat_id)
        history = [{"role": m["role"], "content": m["content"]} for m in raw]
        await asyncio.to_thread(save_message, body.chat_id, "user", body.question)
        await asyncio.to_thread(set_chat_title_if_default, body.chat_id, body.question)

    diff_context: str | None = None
    if body.diff_id:
        diff = await asyncio.to_thread(get_diff, body.diff_id)
        if diff:
            diff_context = format_diff_for_prompt(diff)

    async def event_stream() -> AsyncGenerator[str, None]:
        accumulated: list[str] = []
        saved_sources: list | None = None
        had_error = False
        try:
            source_chunks: list[SourceChunk] = await asyncio.to_thread(
                hybrid_retrieve, body.repo_id, body.question, 5, body.scope_paths
            )
            if get_settings().use_reranker:
                source_chunks = await asyncio.to_thread(
                    get_reranker().rerank, body.question, source_chunks
                )
            saved_sources = source_chunks

            yield f"event: sources\ndata: {json.dumps(source_chunks)}\n\n"

            text_chunks = [sc["chunk"] for sc in source_chunks]
            async for item in stream_answer(body.question, text_chunks, body.mode, history, diff_context):
                if isinstance(item, TokenUsage):
                    yield f"event: usage\ndata: {json.dumps(item.to_dict())}\n\n"
                else:
                    accumulated.append(item)
                    yield f"data: {json.dumps(item)}\n\n"

        except LLMError as exc:
            had_error = True
            logger.warning("LLM error for repo '%s': %s", body.repo_id, exc)
            yield f"data: [ERROR] {exc}\n\n"
        except Exception:
            had_error = True
            logger.exception("Unexpected error in /chat for repo '%s'", body.repo_id)
            yield f"data: [ERROR] Internal server error.\n\n"
        finally:
            if body.chat_id and accumulated:
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
    await asyncio.to_thread(rename_chat, chat_id, body.title)
    updated = await asyncio.to_thread(get_chat, chat_id)
    return ChatInfo(**updated)


@router.delete("/chats/{chat_id}")
async def delete_chat(chat_id: str):
    chat = await asyncio.to_thread(get_chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail=f"Chat '{chat_id}' not found.")
    await asyncio.to_thread(delete_chat, chat_id)
    return {"status": "deleted", "chat_id": chat_id}


@router.get("/chats/{chat_id}/messages", response_model=list[ChatMessageInfo])
async def get_chat_messages(chat_id: str):
    chat = await asyncio.to_thread(get_chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail=f"Chat '{chat_id}' not found.")
    messages = await asyncio.to_thread(list_messages, chat_id)
    return [ChatMessageInfo(**m) for m in messages]
