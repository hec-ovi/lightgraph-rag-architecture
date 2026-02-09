from typing import Annotated, Literal

from pydantic import BaseModel, Field

QueryMode = Literal["naive", "local", "global", "hybrid", "mix"]


class QueryRequest(BaseModel):
    """Request to query a group's knowledge base."""

    query: Annotated[str, Field(min_length=1, description="The search query")]
    mode: Annotated[QueryMode, Field(default="mix", description="RAG query mode")]
    stream: Annotated[bool, Field(default=False, description="Enable SSE streaming response")]


class QueryResponse(BaseModel):
    """RAG query response."""

    query: Annotated[str, Field(description="Original query")]
    mode: Annotated[str, Field(description="Query mode used")]
    response: Annotated[str, Field(description="Generated response from RAG")]
    group_id: Annotated[str, Field(description="Group that was queried")]
