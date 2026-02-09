from pydantic import BaseModel, Field
from typing import Annotated


class GroupCreate(BaseModel):
    """Request to create a new document group."""

    name: Annotated[str, Field(min_length=1, max_length=100, description="Unique group name")]
    description: Annotated[str, Field(default="", max_length=500, description="Group description")]


class GroupUpdate(BaseModel):
    """Request to update a document group."""

    name: Annotated[str | None, Field(default=None, min_length=1, max_length=100, description="New group name")]
    description: Annotated[str | None, Field(default=None, max_length=500, description="New group description")]


class GroupResponse(BaseModel):
    """Document group response."""

    id: Annotated[str, Field(description="Unique group identifier")]
    name: Annotated[str, Field(description="Group name")]
    description: Annotated[str, Field(description="Group description")]
    document_count: Annotated[int, Field(default=0, description="Number of documents in this group")]
    created_at: Annotated[str, Field(description="Creation timestamp")]
    updated_at: Annotated[str, Field(description="Last update timestamp")]


class GroupListResponse(BaseModel):
    """List of document groups."""

    groups: Annotated[list[GroupResponse], Field(description="List of groups")]
    total: Annotated[int, Field(description="Total number of groups")]
