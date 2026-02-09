import logging
from functools import partial
from pathlib import Path

from lightrag import LightRAG, QueryParam
from lightrag.llm.ollama import ollama_embed, ollama_model_complete
from lightrag.utils import EmbeddingFunc

from src.core.config import settings
from src.core.exceptions import GroupNotFoundError, LightRAGNotReadyError

logger = logging.getLogger(__name__)

_instances: dict[str, LightRAG] = {}


def _group_dir(group_id: str) -> Path:
    return Path(settings.data_dir) / "groups" / group_id


async def get_instance(group_id: str) -> LightRAG:
    """Get or create a LightRAG instance for a specific group.

    Each group has its own isolated working directory with separate
    knowledge graph, vector store, and KV storage.

    Args:
        group_id: The group identifier.

    Returns:
        Initialized LightRAG instance.

    Raises:
        GroupNotFoundError: If the group directory does not exist.
        LightRAGNotReadyError: If initialization fails.
    """
    if group_id in _instances:
        return _instances[group_id]

    working_dir = _group_dir(group_id)
    if not working_dir.exists():
        raise GroupNotFoundError(f"Group storage directory not found for '{group_id}'")

    try:
        rag = LightRAG(
            working_dir=str(working_dir),
            llm_model_func=ollama_model_complete,
            llm_model_name=settings.ollama_model,
            llm_model_kwargs={
                "host": settings.ollama_base_url,
                "options": {"num_ctx": settings.lightrag_context_window},
                "timeout": 300,
            },
            embedding_func=EmbeddingFunc(
                embedding_dim=settings.lightrag_embedding_dim,
                max_token_size=settings.lightrag_embedding_max_tokens,
                func=partial(
                    ollama_embed.func,
                    embed_model=settings.ollama_embed_model,
                    host=settings.ollama_base_url,
                ),
            ),
        )
        await rag.initialize_storages()
        _instances[group_id] = rag
        logger.info("LightRAG instance initialized for group '%s'", group_id)
        return rag
    except Exception as e:
        logger.error("Failed to initialize LightRAG for group '%s': %s", group_id, e)
        raise LightRAGNotReadyError(f"LightRAG initialization failed: {e}") from e


async def insert_text(group_id: str, text: str) -> None:
    """Insert text content into a group's knowledge base.

    Args:
        group_id: The group identifier.
        text: Text content to insert and index.
    """
    rag = await get_instance(group_id)
    await rag.ainsert(text)
    logger.info("Inserted %d chars into group '%s'", len(text), group_id)


async def query(group_id: str, query_text: str, mode: str = "mix") -> str:
    """Query a group's knowledge base.

    Args:
        group_id: The group identifier.
        query_text: The search query.
        mode: Query mode (naive, local, global, hybrid, mix).

    Returns:
        Generated response string.
    """
    rag = await get_instance(group_id)
    result = await rag.aquery(query_text, param=QueryParam(mode=mode))
    return result


async def query_stream(group_id: str, query_text: str, mode: str = "mix"):
    """Stream a query response from a group's knowledge base.

    Args:
        group_id: The group identifier.
        query_text: The search query.
        mode: Query mode (naive, local, global, hybrid, mix).

    Yields:
        Response text chunks.
    """
    rag = await get_instance(group_id)
    result = await rag.aquery(query_text, param=QueryParam(mode=mode, stream=True))
    async for chunk in result:
        yield chunk


async def remove_instance(group_id: str) -> None:
    """Remove a cached LightRAG instance for a group.

    Args:
        group_id: The group identifier.
    """
    if group_id in _instances:
        rag = _instances.pop(group_id)
        try:
            await rag.finalize_storages()
        except Exception:
            pass
        logger.info("LightRAG instance removed for group '%s'", group_id)


async def shutdown_all() -> None:
    """Finalize all cached LightRAG instances. Called on app shutdown."""
    for group_id in list(_instances.keys()):
        await remove_instance(group_id)
    logger.info("All LightRAG instances shut down")
