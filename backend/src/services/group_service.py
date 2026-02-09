import uuid
from pathlib import Path

from src.core.config import settings
from src.core.database import get_connection
from src.core.exceptions import GroupAlreadyExistsError, GroupNotFoundError
from src.models.group import GroupCreate, GroupListResponse, GroupResponse, GroupUpdate


async def create_group(data: GroupCreate) -> GroupResponse:
    """Create a new document group with its own isolated storage directory.

    Args:
        data: Group creation data with name and description.

    Returns:
        GroupResponse with created group details.

    Raises:
        GroupAlreadyExistsError: If a group with the same name exists.
    """
    group_id = uuid.uuid4().hex[:12]
    db = await get_connection()
    try:
        existing = await db.execute("SELECT id FROM groups WHERE name = ?", (data.name,))
        if await existing.fetchone():
            raise GroupAlreadyExistsError(f"Group '{data.name}' already exists")

        await db.execute(
            "INSERT INTO groups (id, name, description) VALUES (?, ?, ?)",
            (group_id, data.name, data.description),
        )
        await db.commit()

        group_dir = Path(settings.data_dir) / "groups" / group_id
        group_dir.mkdir(parents=True, exist_ok=True)

        row = await db.execute("SELECT * FROM groups WHERE id = ?", (group_id,))
        group = await row.fetchone()
        return GroupResponse(
            id=group["id"],
            name=group["name"],
            description=group["description"],
            document_count=0,
            created_at=group["created_at"],
            updated_at=group["updated_at"],
        )
    finally:
        await db.close()


async def list_groups() -> GroupListResponse:
    """List all document groups with their document counts.

    Returns:
        GroupListResponse with all groups and total count.
    """
    db = await get_connection()
    try:
        cursor = await db.execute("""
            SELECT g.*, COUNT(d.id) as doc_count
            FROM groups g
            LEFT JOIN documents d ON d.group_id = g.id
            GROUP BY g.id
            ORDER BY g.created_at DESC
        """)
        rows = await cursor.fetchall()
        groups = [
            GroupResponse(
                id=row["id"],
                name=row["name"],
                description=row["description"],
                document_count=row["doc_count"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
            )
            for row in rows
        ]
        return GroupListResponse(groups=groups, total=len(groups))
    finally:
        await db.close()


async def get_group(group_id: str) -> GroupResponse:
    """Get a single document group by ID.

    Args:
        group_id: The group identifier.

    Returns:
        GroupResponse with group details.

    Raises:
        GroupNotFoundError: If the group does not exist.
    """
    db = await get_connection()
    try:
        cursor = await db.execute(
            """
            SELECT g.*, COUNT(d.id) as doc_count
            FROM groups g
            LEFT JOIN documents d ON d.group_id = g.id
            WHERE g.id = ?
            GROUP BY g.id
            """,
            (group_id,),
        )
        row = await cursor.fetchone()
        if not row:
            raise GroupNotFoundError(f"Group '{group_id}' not found")
        return GroupResponse(
            id=row["id"],
            name=row["name"],
            description=row["description"],
            document_count=row["doc_count"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
    finally:
        await db.close()


async def update_group(group_id: str, data: GroupUpdate) -> GroupResponse:
    """Update a document group's name or description.

    Args:
        group_id: The group identifier.
        data: Fields to update.

    Returns:
        GroupResponse with updated group details.

    Raises:
        GroupNotFoundError: If the group does not exist.
        GroupAlreadyExistsError: If the new name conflicts with an existing group.
    """
    db = await get_connection()
    try:
        cursor = await db.execute("SELECT * FROM groups WHERE id = ?", (group_id,))
        existing = await cursor.fetchone()
        if not existing:
            raise GroupNotFoundError(f"Group '{group_id}' not found")

        name = data.name if data.name is not None else existing["name"]
        description = data.description if data.description is not None else existing["description"]

        if data.name is not None and data.name != existing["name"]:
            dup = await db.execute("SELECT id FROM groups WHERE name = ? AND id != ?", (data.name, group_id))
            if await dup.fetchone():
                raise GroupAlreadyExistsError(f"Group '{data.name}' already exists")

        await db.execute(
            "UPDATE groups SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?",
            (name, description, group_id),
        )
        await db.commit()
        return await get_group(group_id)
    finally:
        await db.close()


async def delete_group(group_id: str) -> None:
    """Delete a document group and all its data.

    Args:
        group_id: The group identifier.

    Raises:
        GroupNotFoundError: If the group does not exist.
    """
    db = await get_connection()
    try:
        cursor = await db.execute("SELECT id FROM groups WHERE id = ?", (group_id,))
        if not await cursor.fetchone():
            raise GroupNotFoundError(f"Group '{group_id}' not found")

        await db.execute("DELETE FROM groups WHERE id = ?", (group_id,))
        await db.commit()

        import shutil
        group_dir = Path(settings.data_dir) / "groups" / group_id
        if group_dir.exists():
            shutil.rmtree(group_dir)
    finally:
        await db.close()
