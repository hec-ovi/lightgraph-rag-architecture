from pydantic import BaseModel, Field
from typing import Annotated


class DocumentInsert(BaseModel):
    """Request to insert text content into a group's knowledge base."""

    content: Annotated[str, Field(min_length=1, description="Text content to insert")]
    filename: Annotated[str, Field(default="manual_input.txt", description="Source filename for tracking")]


class DocumentResponse(BaseModel):
    """Document metadata response."""

    id: Annotated[str, Field(description="Unique document identifier")]
    group_id: Annotated[str, Field(description="Parent group identifier")]
    filename: Annotated[str, Field(description="Source filename")]
    content_length: Annotated[int, Field(description="Character count of the inserted content")]
    created_at: Annotated[str, Field(description="Insertion timestamp")]


class DocumentListResponse(BaseModel):
    """List of documents in a group."""

    documents: Annotated[list[DocumentResponse], Field(description="List of documents")]
    total: Annotated[int, Field(description="Total number of documents")]
