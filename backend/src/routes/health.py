from fastapi import APIRouter

from src.models.health import HealthResponse
from src.services import health_service

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check() -> HealthResponse:
    """Check if the backend service is running."""
    return await health_service.check_health()
