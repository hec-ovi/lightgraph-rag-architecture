from typing import Annotated, Literal

from pydantic import BaseModel, Field

from src.models.query import QueryMode


class ConversationCreate(BaseModel):
    """Request to create a new conversation."""

    title: Annotated[str, Field(default="New Conversation", max_length=200, description="Conversation title")]


class ConversationResponse(BaseModel):
    """Conversation metadata response."""

    id: Annotated[str, Field(description="Unique conversation identifier")]
    group_id: Annotated[str, Field(description="Parent group identifier")]
    title: Annotated[str, Field(description="Conversation title")]
    message_count: Annotated[int, Field(default=0, description="Number of messages")]
    created_at: Annotated[str, Field(description="Creation timestamp")]
    updated_at: Annotated[str, Field(description="Last update timestamp")]


class ConversationListResponse(BaseModel):
    """List of conversations in a group."""

    conversations: Annotated[list[ConversationResponse], Field(description="List of conversations")]
    total: Annotated[int, Field(description="Total number of conversations")]


class MessageResponse(BaseModel):
    """Single chat message."""

    id: Annotated[str, Field(description="Unique message identifier")]
    conversation_id: Annotated[str, Field(description="Parent conversation identifier")]
    role: Annotated[Literal["user", "assistant"], Field(description="Message author role")]
    content: Annotated[str, Field(description="Message content")]
    query_mode: Annotated[str | None, Field(default=None, description="RAG mode used (assistant messages only)")]
    created_at: Annotated[str, Field(description="Message timestamp")]


class ChatRequest(BaseModel):
    """Request to send a message in a conversation."""

    message: Annotated[str, Field(min_length=1, description="User message")]
    mode: Annotated[QueryMode, Field(default="mix", description="RAG query mode")]
    stream: Annotated[bool, Field(default=False, description="Enable SSE streaming response")]


class ChatResponse(BaseModel):
    """Chat response with both user and assistant messages."""

    user_message: Annotated[MessageResponse, Field(description="The user's message")]
    assistant_message: Annotated[MessageResponse, Field(description="The assistant's response")]


class ConversationHistoryResponse(BaseModel):
    """Full conversation with all messages."""

    conversation: Annotated[ConversationResponse, Field(description="Conversation metadata")]
    messages: Annotated[list[MessageResponse], Field(description="All messages in order")]
