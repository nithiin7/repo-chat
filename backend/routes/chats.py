import asyncio
import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.config import get_settings
from backend.core.llm import LLMError, generate_suggestions, stream_answer
from backend.core.retriever import SourceChunk, retrieve
from backend.persistence import (
    delete_chat,
    get_chat,
    get_repo,
    list_messages,
    rename_chat,
    save_message,
    set_chat_title_if_default,
)
from backend.schemas import ChatInfo, ChatMessageInfo, ChatRequest, RenameChatRequest

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

    if body.chat_id:
        await asyncio.to_thread(save_message, body.chat_id, "user", body.question)
        await asyncio.to_thread(set_chat_title_if_default, body.chat_id, body.question)

    async def event_stream() -> AsyncGenerator[str, None]:
        accumulated: list[str] = []
        saved_sources: list | None = None
        had_error = False
        try:
            source_chunks: list[SourceChunk] = await asyncio.to_thread(
                retrieve, body.repo_id, body.question
            )
            saved_sources = source_chunks

            yield f"event: sources\ndata: {json.dumps(source_chunks)}\n\n"

            text_chunks = [sc["chunk"] for sc in source_chunks]
            async for token in stream_answer(body.question, text_chunks, body.mode):
                accumulated.append(token)
                yield f"data: {json.dumps(token)}\n\n"

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
