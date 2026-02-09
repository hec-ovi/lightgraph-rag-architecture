import json

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from src.core.exceptions import ConversationNotFoundError, GroupNotFoundError, LightRAGNotReadyError
from src.models.conversation import (
    ChatRequest,
    ChatResponse,
    ConversationCreate,
    ConversationHistoryResponse,
    ConversationListResponse,
    ConversationResponse,
)
from src.services import conversation_service

router = APIRouter(prefix="/groups/{group_id}/conversations", tags=["Conversations"])


@router.post("", status_code=201)
async def create_conversation(group_id: str, data: ConversationCreate) -> ConversationResponse:
    """Create a new conversation session tied to a document group."""
    try:
        return await conversation_service.create_conversation(group_id, data)
    except GroupNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("")
async def list_conversations(group_id: str) -> ConversationListResponse:
    """List all conversations in a group, ordered by most recently updated."""
    try:
        return await conversation_service.list_conversations(group_id)
    except GroupNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{conversation_id}")
async def get_conversation(group_id: str, conversation_id: str) -> ConversationHistoryResponse:
    """Get a conversation with its full message history."""
    try:
        return await conversation_service.get_conversation_history(group_id, conversation_id)
    except GroupNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ConversationNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{conversation_id}/chat")
async def chat(group_id: str, conversation_id: str, data: ChatRequest) -> ChatResponse:
    """Send a message in a conversation and get a RAG-powered response.

    The conversation history is passed to LightRAG for context-aware answers.
    Set `stream: true` for Server-Sent Events streaming.
    """
    if data.stream:
        return _stream_chat(group_id, conversation_id, data)

    try:
        return await conversation_service.chat(group_id, conversation_id, data.message, data.mode)
    except GroupNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ConversationNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except LightRAGNotReadyError as e:
        raise HTTPException(status_code=503, detail=str(e))


def _stream_chat(group_id: str, conversation_id: str, data: ChatRequest) -> EventSourceResponse:
    async def event_generator():
        try:
            async for chunk in conversation_service.chat_stream(
                group_id, conversation_id, data.message, data.mode
            ):
                yield {"event": "chunk", "data": chunk}
            yield {
                "event": "done",
                "data": json.dumps({
                    "group_id": group_id,
                    "conversation_id": conversation_id,
                    "mode": data.mode,
                }),
            }
        except (GroupNotFoundError, ConversationNotFoundError) as e:
            yield {"event": "error", "data": json.dumps({"detail": str(e)})}
        except LightRAGNotReadyError as e:
            yield {"event": "error", "data": json.dumps({"detail": str(e)})}

    return EventSourceResponse(event_generator())


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(group_id: str, conversation_id: str) -> None:
    """Delete a conversation and all its messages."""
    try:
        await conversation_service.delete_conversation(group_id, conversation_id)
    except GroupNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ConversationNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
