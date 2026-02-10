from typing import Annotated

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response."""

    status: Annotated[str, Field(description="Service status")]
    service: Annotated[str, Field(description="Service name")]
    version: Annotated[str, Field(description="API version")]
    models_loaded: Annotated[bool, Field(description="Whether required models are loaded")]
    loaded_models: Annotated[list[str], Field(description="Currently loaded Ollama models")]
