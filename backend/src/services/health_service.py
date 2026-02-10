from src.core.config import settings
from src.models.health import HealthResponse
from src.tools.ollama_client import list_running_models


async def check_health() -> HealthResponse:
    loaded_models: list[str] = []
    models_loaded = False
    try:
        loaded_models = await list_running_models(
            settings.ollama_base_url,
            settings.ollama_health_timeout_seconds,
        )
        expected = {settings.ollama_model, settings.ollama_embed_model}
        models_loaded = expected.issubset(set(loaded_models))
    except Exception:
        loaded_models = []
        models_loaded = False

    return HealthResponse(
        status="healthy",
        service="lightgraph-rag-api",
        version="0.1.0",
        models_loaded=models_loaded,
        loaded_models=loaded_models,
    )
