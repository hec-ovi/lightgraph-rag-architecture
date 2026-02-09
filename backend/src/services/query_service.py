from collections.abc import AsyncGenerator

from src.core.exceptions import GroupNotFoundError
from src.core.database import get_connection
from src.models.query import QueryResponse
from src.services import lightrag_service


async def _verify_group_exists(group_id: str) -> None:
    db = await get_connection()
    try:
        cursor = await db.execute("SELECT id FROM groups WHERE id = ?", (group_id,))
        if not await cursor.fetchone():
            raise GroupNotFoundError(f"Group '{group_id}' not found")
    finally:
        await db.close()


async def query_group(group_id: str, query_text: str, mode: str = "mix") -> QueryResponse:
    """Query a group's knowledge base using the specified RAG mode.

    Args:
        group_id: The group identifier.
        query_text: The search query.
        mode: RAG mode — naive (vector-only), local, global, hybrid, or mix (graph + vector).

    Returns:
        QueryResponse with the generated answer.

    Raises:
        GroupNotFoundError: If the group does not exist.
    """
    await _verify_group_exists(group_id)

    response = await lightrag_service.query(group_id, query_text, mode)
    return QueryResponse(
        query=query_text,
        mode=mode,
        response=response,
        group_id=group_id,
    )


async def query_group_stream(group_id: str, query_text: str, mode: str = "mix") -> AsyncGenerator[str]:
    """Stream a query response from a group's knowledge base.

    Args:
        group_id: The group identifier.
        query_text: The search query.
        mode: RAG mode.

    Yields:
        Response text chunks.

    Raises:
        GroupNotFoundError: If the group does not exist.
    """
    await _verify_group_exists(group_id)

    async for chunk in lightrag_service.query_stream(group_id, query_text, mode):
        yield chunk
