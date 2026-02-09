import uuid
from collections.abc import AsyncGenerator

from src.core.database import get_connection
from src.core.exceptions import ConversationNotFoundError, GroupNotFoundError
from src.models.conversation import (
    ChatResponse,
    ConversationCreate,
    ConversationHistoryResponse,
    ConversationListResponse,
    ConversationResponse,
    MessageResponse,
)
from src.services import lightrag_service


async def _verify_group_exists(group_id: str) -> None:
    db = await get_connection()
    try:
        cursor = await db.execute("SELECT id FROM groups WHERE id = ?", (group_id,))
        if not await cursor.fetchone():
            raise GroupNotFoundError(f"Group '{group_id}' not found")
    finally:
        await db.close()


async def _get_conversation_row(group_id: str, conversation_id: str) -> dict:
    db = await get_connection()
    try:
        cursor = await db.execute(
            "SELECT * FROM conversations WHERE id = ? AND group_id = ?",
            (conversation_id, group_id),
        )
        row = await cursor.fetchone()
        if not row:
            raise ConversationNotFoundError(
                f"Conversation '{conversation_id}' not found in group '{group_id}'"
            )
        return dict(row)
    finally:
        await db.close()


async def create_conversation(group_id: str, data: ConversationCreate) -> ConversationResponse:
    """Create a new conversation session tied to a group.

    Args:
        group_id: The group identifier.
        data: Conversation creation data.

    Returns:
        ConversationResponse with conversation metadata.

    Raises:
        GroupNotFoundError: If the group does not exist.
    """
    await _verify_group_exists(group_id)

    conv_id = uuid.uuid4().hex[:12]
    db = await get_connection()
    try:
        await db.execute(
            "INSERT INTO conversations (id, group_id, title) VALUES (?, ?, ?)",
            (conv_id, group_id, data.title),
        )
        await db.commit()

        cursor = await db.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,))
        row = await cursor.fetchone()
        return ConversationResponse(
            id=row["id"],
            group_id=row["group_id"],
            title=row["title"],
            message_count=0,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
    finally:
        await db.close()


async def list_conversations(group_id: str) -> ConversationListResponse:
    """List all conversations in a group.

    Args:
        group_id: The group identifier.

    Returns:
        ConversationListResponse with all conversations.

    Raises:
        GroupNotFoundError: If the group does not exist.
    """
    await _verify_group_exists(group_id)

    db = await get_connection()
    try:
        cursor = await db.execute(
            """
            SELECT c.*, COUNT(m.id) as msg_count
            FROM conversations c
            LEFT JOIN messages m ON m.conversation_id = c.id
            WHERE c.group_id = ?
            GROUP BY c.id
            ORDER BY c.updated_at DESC
            """,
            (group_id,),
        )
        rows = await cursor.fetchall()
        conversations = [
            ConversationResponse(
                id=row["id"],
                group_id=row["group_id"],
                title=row["title"],
                message_count=row["msg_count"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
            )
            for row in rows
        ]
        return ConversationListResponse(conversations=conversations, total=len(conversations))
    finally:
        await db.close()


async def get_conversation_history(group_id: str, conversation_id: str) -> ConversationHistoryResponse:
    """Get a conversation with all its messages.

    Args:
        group_id: The group identifier.
        conversation_id: The conversation identifier.

    Returns:
        ConversationHistoryResponse with metadata and all messages.

    Raises:
        GroupNotFoundError: If the group does not exist.
        ConversationNotFoundError: If the conversation does not exist.
    """
    await _verify_group_exists(group_id)
    conv_row = await _get_conversation_row(group_id, conversation_id)

    db = await get_connection()
    try:
        cursor = await db.execute(
            "SELECT COUNT(*) as cnt FROM messages WHERE conversation_id = ?",
            (conversation_id,),
        )
        count_row = await cursor.fetchone()

        cursor = await db.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            (conversation_id,),
        )
        msg_rows = await cursor.fetchall()

        conversation = ConversationResponse(
            id=conv_row["id"],
            group_id=conv_row["group_id"],
            title=conv_row["title"],
            message_count=count_row["cnt"],
            created_at=conv_row["created_at"],
            updated_at=conv_row["updated_at"],
        )
        messages = [
            MessageResponse(
                id=row["id"],
                conversation_id=row["conversation_id"],
                role=row["role"],
                content=row["content"],
                query_mode=row["query_mode"],
                created_at=row["created_at"],
            )
            for row in msg_rows
        ]
        return ConversationHistoryResponse(conversation=conversation, messages=messages)
    finally:
        await db.close()


async def _get_history_for_lightrag(conversation_id: str, max_turns: int = 5) -> list[dict[str, str]]:
    """Build conversation history in the format LightRAG expects."""
    db = await get_connection()
    try:
        cursor = await db.execute(
            """
            SELECT role, content FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (conversation_id, max_turns * 2),
        )
        rows = await cursor.fetchall()
        return [{"role": row["role"], "content": row["content"]} for row in reversed(rows)]
    finally:
        await db.close()


async def chat(group_id: str, conversation_id: str, message: str, mode: str = "mix") -> ChatResponse:
    """Send a message in a conversation and get a RAG-powered response.

    Args:
        group_id: The group identifier.
        conversation_id: The conversation identifier.
        message: User message text.
        mode: RAG query mode.

    Returns:
        ChatResponse with both user and assistant messages.

    Raises:
        GroupNotFoundError: If the group does not exist.
        ConversationNotFoundError: If the conversation does not exist.
    """
    await _verify_group_exists(group_id)
    await _get_conversation_row(group_id, conversation_id)

    user_msg_id = uuid.uuid4().hex[:12]
    assistant_msg_id = uuid.uuid4().hex[:12]

    db = await get_connection()
    try:
        await db.execute(
            "INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, 'user', ?)",
            (user_msg_id, conversation_id, message),
        )
        await db.commit()
    finally:
        await db.close()

    history = await _get_history_for_lightrag(conversation_id)

    rag = await lightrag_service.get_instance(group_id)
    from lightrag import QueryParam
    response = await rag.aquery(
        message,
        param=QueryParam(mode=mode, conversation_history=history),
    )

    db = await get_connection()
    try:
        await db.execute(
            "INSERT INTO messages (id, conversation_id, role, content, query_mode) VALUES (?, ?, 'assistant', ?, ?)",
            (assistant_msg_id, conversation_id, response, mode),
        )
        await db.execute(
            "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?",
            (conversation_id,),
        )
        await db.commit()

        user_cursor = await db.execute("SELECT * FROM messages WHERE id = ?", (user_msg_id,))
        user_row = await user_cursor.fetchone()
        asst_cursor = await db.execute("SELECT * FROM messages WHERE id = ?", (assistant_msg_id,))
        asst_row = await asst_cursor.fetchone()

        return ChatResponse(
            user_message=MessageResponse(
                id=user_row["id"],
                conversation_id=user_row["conversation_id"],
                role=user_row["role"],
                content=user_row["content"],
                query_mode=user_row["query_mode"],
                created_at=user_row["created_at"],
            ),
            assistant_message=MessageResponse(
                id=asst_row["id"],
                conversation_id=asst_row["conversation_id"],
                role=asst_row["role"],
                content=asst_row["content"],
                query_mode=asst_row["query_mode"],
                created_at=asst_row["created_at"],
            ),
        )
    finally:
        await db.close()


async def chat_stream(
    group_id: str, conversation_id: str, message: str, mode: str = "mix"
) -> AsyncGenerator[str]:
    """Stream a chat response with conversation history.

    Args:
        group_id: The group identifier.
        conversation_id: The conversation identifier.
        message: User message text.
        mode: RAG query mode.

    Yields:
        Response text chunks.
    """
    await _verify_group_exists(group_id)
    await _get_conversation_row(group_id, conversation_id)

    user_msg_id = uuid.uuid4().hex[:12]
    db = await get_connection()
    try:
        await db.execute(
            "INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, 'user', ?)",
            (user_msg_id, conversation_id, message),
        )
        await db.commit()
    finally:
        await db.close()

    history = await _get_history_for_lightrag(conversation_id)

    rag = await lightrag_service.get_instance(group_id)
    from lightrag import QueryParam
    result = await rag.aquery(
        message,
        param=QueryParam(mode=mode, stream=True, conversation_history=history),
    )

    full_response = []
    async for chunk in result:
        full_response.append(chunk)
        yield chunk

    assistant_msg_id = uuid.uuid4().hex[:12]
    db = await get_connection()
    try:
        await db.execute(
            "INSERT INTO messages (id, conversation_id, role, content, query_mode) VALUES (?, ?, 'assistant', ?, ?)",
            (assistant_msg_id, conversation_id, "".join(full_response), mode),
        )
        await db.execute(
            "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?",
            (conversation_id,),
        )
        await db.commit()
    finally:
        await db.close()


async def delete_conversation(group_id: str, conversation_id: str) -> None:
    """Delete a conversation and all its messages.

    Args:
        group_id: The group identifier.
        conversation_id: The conversation identifier.

    Raises:
        GroupNotFoundError: If the group does not exist.
        ConversationNotFoundError: If the conversation does not exist.
    """
    await _verify_group_exists(group_id)
    await _get_conversation_row(group_id, conversation_id)

    db = await get_connection()
    try:
        await db.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
        await db.commit()
    finally:
        await db.close()
