import uuid

from src.core.database import get_connection
from src.core.exceptions import DocumentNotFoundError, GroupNotFoundError
from src.models.document import DocumentListResponse, DocumentResponse
from src.services import lightrag_service


async def _verify_group_exists(group_id: str) -> None:
    db = await get_connection()
    try:
        cursor = await db.execute("SELECT id FROM groups WHERE id = ?", (group_id,))
        if not await cursor.fetchone():
            raise GroupNotFoundError(f"Group '{group_id}' not found")
    finally:
        await db.close()


async def insert_document(group_id: str, content: str, filename: str) -> DocumentResponse:
    """Insert text content into a group's knowledge base via LightRAG.

    Args:
        group_id: The group identifier.
        content: Text content to insert.
        filename: Source filename for tracking.

    Returns:
        DocumentResponse with document metadata.

    Raises:
        GroupNotFoundError: If the group does not exist.
    """
    await _verify_group_exists(group_id)

    doc_id = uuid.uuid4().hex[:12]

    await lightrag_service.insert_text(group_id, content)

    db = await get_connection()
    try:
        await db.execute(
            "INSERT INTO documents (id, group_id, filename, content_length) VALUES (?, ?, ?, ?)",
            (doc_id, group_id, filename, len(content)),
        )
        await db.commit()

        cursor = await db.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
        row = await cursor.fetchone()
        return DocumentResponse(
            id=row["id"],
            group_id=row["group_id"],
            filename=row["filename"],
            content_length=row["content_length"],
            created_at=row["created_at"],
        )
    finally:
        await db.close()


async def list_documents(group_id: str) -> DocumentListResponse:
    """List all documents in a group.

    Args:
        group_id: The group identifier.

    Returns:
        DocumentListResponse with all documents and total count.

    Raises:
        GroupNotFoundError: If the group does not exist.
    """
    await _verify_group_exists(group_id)

    db = await get_connection()
    try:
        cursor = await db.execute(
            "SELECT * FROM documents WHERE group_id = ? ORDER BY created_at DESC",
            (group_id,),
        )
        rows = await cursor.fetchall()
        documents = [
            DocumentResponse(
                id=row["id"],
                group_id=row["group_id"],
                filename=row["filename"],
                content_length=row["content_length"],
                created_at=row["created_at"],
            )
            for row in rows
        ]
        return DocumentListResponse(documents=documents, total=len(documents))
    finally:
        await db.close()


async def get_document(group_id: str, document_id: str) -> DocumentResponse:
    """Get a single document by ID.

    Args:
        group_id: The group identifier.
        document_id: The document identifier.

    Returns:
        DocumentResponse with document metadata.

    Raises:
        GroupNotFoundError: If the group does not exist.
        DocumentNotFoundError: If the document does not exist.
    """
    await _verify_group_exists(group_id)

    db = await get_connection()
    try:
        cursor = await db.execute(
            "SELECT * FROM documents WHERE id = ? AND group_id = ?",
            (document_id, group_id),
        )
        row = await cursor.fetchone()
        if not row:
            raise DocumentNotFoundError(f"Document '{document_id}' not found in group '{group_id}'")
        return DocumentResponse(
            id=row["id"],
            group_id=row["group_id"],
            filename=row["filename"],
            content_length=row["content_length"],
            created_at=row["created_at"],
        )
    finally:
        await db.close()
