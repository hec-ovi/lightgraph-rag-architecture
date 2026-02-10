from __future__ import annotations

from typing import Annotated

import httpx
from pydantic import BaseModel, Field


class OllamaModelDetails(BaseModel):
    parent_model: Annotated[str | None, Field(default=None)]
    format: Annotated[str | None, Field(default=None)]
    family: Annotated[str | None, Field(default=None)]
    families: Annotated[list[str] | None, Field(default=None)]
    parameter_size: Annotated[str | None, Field(default=None)]
    quantization_level: Annotated[str | None, Field(default=None)]


class OllamaRunningModel(BaseModel):
    model: Annotated[str, Field(description="Model identifier with tag")]
    name: Annotated[str | None, Field(default=None)]
    size: Annotated[int | None, Field(default=None)]
    digest: Annotated[str | None, Field(default=None)]
    details: Annotated[OllamaModelDetails | None, Field(default=None)]
    expires_at: Annotated[str | None, Field(default=None)]
    size_vram: Annotated[int | None, Field(default=None)]
    context_length: Annotated[int | None, Field(default=None)]


class OllamaPsResponse(BaseModel):
    models: Annotated[list[OllamaRunningModel], Field(default_factory=list)]


class OllamaGenerateRequest(BaseModel):
    model: Annotated[str, Field(description="Model identifier with tag")]
    prompt: Annotated[str, Field(description="Prompt to warm the model")]
    stream: Annotated[bool, Field(default=False)]
    keep_alive: Annotated[str | None, Field(default=None)]


class OllamaEmbeddingsRequest(BaseModel):
    model: Annotated[str, Field(description="Model identifier with tag")]
    input: Annotated[str, Field(description="Input text to warm the model")]
    keep_alive: Annotated[str | None, Field(default=None)]


async def list_running_models(base_url: str, timeout_seconds: int) -> list[str]:
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.get(f"{base_url}/api/ps")
        response.raise_for_status()
        payload = OllamaPsResponse.model_validate(response.json())
        return [model.model for model in payload.models]


async def warmup_generate(
    base_url: str,
    request: OllamaGenerateRequest,
    timeout_seconds: int,
) -> None:
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.post(f"{base_url}/api/generate", json=request.model_dump(exclude_none=True))
        response.raise_for_status()


async def warmup_embeddings(
    base_url: str,
    request: OllamaEmbeddingsRequest,
    timeout_seconds: int,
) -> None:
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.post(f"{base_url}/api/embed", json=request.model_dump(exclude_none=True))
        response.raise_for_status()
