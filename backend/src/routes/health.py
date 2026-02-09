from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Annotated

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    """Health check response."""

    status: Annotated[str, Field(description="Service status")]
    service: Annotated[str, Field(description="Service name")]
    version: Annotated[str, Field(description="API version")]


@router.get("/health")
async def health_check() -> HealthResponse:
    """Check if the backend service is running."""
    return HealthResponse(
        status="healthy",
        service="lightgraph-rag-api",
        version="0.1.0",
    )
