from fastapi import APIRouter, HTTPException, UploadFile

from src.core.exceptions import DocumentNotFoundError, GroupNotFoundError, LightRAGNotReadyError
from src.models.document import DocumentInsert, DocumentListResponse, DocumentResponse
from src.services import document_service
from src.tools.text_extractor import extract_text

router = APIRouter(prefix="/groups/{group_id}/documents", tags=["Documents"])


@router.post("", status_code=201)
async def insert_text(group_id: str, data: DocumentInsert) -> DocumentResponse:
    """Insert raw text content into a group's knowledge base.

    LightRAG will extract entities, build knowledge graph relationships,
    and index the content for both graph-based and vector-based retrieval.
    """
    try:
        return await document_service.insert_document(group_id, data.content, data.filename)
    except GroupNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except LightRAGNotReadyError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/upload", status_code=201)
async def upload_file(group_id: str, file: UploadFile) -> DocumentResponse:
    """Upload a file to insert into a group's knowledge base.

    Supported formats: .txt, .md, .csv, .json, .xml, .html, .py, .js, .ts, .yaml, .yml, .log, .pdf
    """
    try:
        content_bytes = await file.read()
        filename = file.filename or "uploaded_file.txt"
        text = extract_text(content_bytes, filename)
        return await document_service.insert_document(group_id, text, filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except GroupNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except LightRAGNotReadyError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("")
async def list_documents(group_id: str) -> DocumentListResponse:
    """List all documents in a group."""
    try:
        return await document_service.list_documents(group_id)
    except GroupNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{document_id}")
async def get_document(group_id: str, document_id: str) -> DocumentResponse:
    """Get a single document's metadata."""
    try:
        return await document_service.get_document(group_id, document_id)
    except GroupNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except DocumentNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
