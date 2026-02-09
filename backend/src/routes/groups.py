from fastapi import APIRouter, HTTPException

from src.core.exceptions import GroupAlreadyExistsError, GroupNotFoundError
from src.models.group import GroupCreate, GroupListResponse, GroupResponse, GroupUpdate
from src.services import group_service

router = APIRouter(prefix="/groups", tags=["Groups"])


@router.post("", status_code=201)
async def create_group(data: GroupCreate) -> GroupResponse:
    """Create a new document group with isolated knowledge graph storage."""
    try:
        return await group_service.create_group(data)
    except GroupAlreadyExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("")
async def list_groups() -> GroupListResponse:
    """List all document groups with document counts."""
    return await group_service.list_groups()


@router.get("/{group_id}")
async def get_group(group_id: str) -> GroupResponse:
    """Get a single document group by ID."""
    try:
        return await group_service.get_group(group_id)
    except GroupNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/{group_id}")
async def update_group(group_id: str, data: GroupUpdate) -> GroupResponse:
    """Update a document group's name or description."""
    try:
        return await group_service.update_group(group_id, data)
    except GroupNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except GroupAlreadyExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.delete("/{group_id}", status_code=204)
async def delete_group(group_id: str) -> None:
    """Delete a document group and all its data (documents, conversations, knowledge graph)."""
    try:
        await group_service.delete_group(group_id)
    except GroupNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
