import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from sse_starlette.sse import EventSourceResponse

from src.core.exceptions import GroupNotFoundError, LightRAGNotReadyError
from src.models.query import QueryRequest, QueryResponse
from src.services import query_service

router = APIRouter(prefix="/groups/{group_id}/query", tags=["Query"])


@router.post("")
async def query_group(group_id: str, data: QueryRequest) -> QueryResponse:
    """Query a group's knowledge base using RAG.

    Modes:
    - **naive**: Vector similarity search only (traditional RAG)
    - **local**: Knowledge graph — entity-focused, context-dependent retrieval
    - **global**: Knowledge graph — broad relationship retrieval
    - **hybrid**: Combines local + global graph retrieval
    - **mix**: Combines knowledge graph + vector retrieval (recommended)
    """
    try:
        return await query_service.query_group(group_id, data.query, data.mode)
    except GroupNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except LightRAGNotReadyError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/stream", response_class=Response)
async def query_group_stream(group_id: str, data: QueryRequest) -> EventSourceResponse:
    """Stream a query response via Server-Sent Events.

    SSE event format:
    - `event: chunk` / `data: <text>` — response text chunk
    - `event: done` / `data: {"query", "mode", "group_id"}` — stream complete
    - `event: error` / `data: {"detail": "..."}` — error occurred
    """
    async def event_generator():
        try:
            async for chunk in query_service.query_group_stream(group_id, data.query, data.mode):
                yield {"event": "chunk", "data": chunk}
            yield {"event": "done", "data": json.dumps({"query": data.query, "mode": data.mode, "group_id": group_id})}
        except GroupNotFoundError as e:
            yield {"event": "error", "data": json.dumps({"detail": str(e)})}
        except LightRAGNotReadyError as e:
            yield {"event": "error", "data": json.dumps({"detail": str(e)})}

    return EventSourceResponse(event_generator())
