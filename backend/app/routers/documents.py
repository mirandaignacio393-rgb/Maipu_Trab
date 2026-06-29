"""Endpoints de documentos (base de conocimiento) por área."""
from __future__ import annotations

import uuid

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from pydantic import BaseModel

from ..auth import CurrentUser, CurrentUserDep, require_area_access
from ..clients import get_pool, get_supabase
from ..config import get_settings
from ..services.ingest import process_document

router = APIRouter(tags=["documents"])
_settings = get_settings()

# Mapea extensiones a tipos internos
_EXT_TYPE = {
    "pdf": "pdf",
    "docx": "docx",
    "doc": "docx",
    "xlsx": "xlsx",
    "xls": "xlsx",
    "pptx": "pptx",
    "ppt": "pptx",
    "png": "image",
    "jpg": "image",
    "jpeg": "image",
    "gif": "image",
    "webp": "image",
    "txt": "text",
    "md": "text",
}


class LinkIn(BaseModel):
    name: str
    url: str
    type: str = "link"  # link | youtube


def _detect_type(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in _EXT_TYPE:
        raise HTTPException(status_code=400, detail=f"Extensión no soportada: .{ext}")
    return _EXT_TYPE[ext]


@router.post("/areas/{area_id}/documents/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    area_id: str,
    background: BackgroundTasks,
    file: UploadFile = File(...),
    user: CurrentUser = CurrentUserDep,
) -> dict:
    company_id = require_area_access(area_id, user)
    doc_type = _detect_type(file.filename or "archivo")
    data = await file.read()

    storage_path = f"{area_id}/{uuid.uuid4().hex}_{file.filename}"
    sb = get_supabase()
    sb.storage.from_(_settings.storage_bucket).upload(
        storage_path,
        data,
        {"content-type": file.content_type or "application/octet-stream", "upsert": "true"},
    )

    pool = get_pool()
    with pool.connection() as conn:
        row = conn.execute(
            """
            insert into public.documents
                (area_id, company_id, name, type, storage_path, status, uploaded_by)
            values (%s, %s, %s, %s, %s, 'pending', %s)
            returning id
            """,
            (area_id, company_id, file.filename, doc_type, storage_path, user.id),
        ).fetchone()
    document_id = str(row[0])

    background.add_task(process_document, document_id)
    return {"id": document_id, "name": file.filename, "type": doc_type, "status": "pending"}


@router.post("/areas/{area_id}/documents/link", status_code=status.HTTP_201_CREATED)
def add_link(
    area_id: str,
    body: LinkIn,
    background: BackgroundTasks,
    user: CurrentUser = CurrentUserDep,
) -> dict:
    company_id = require_area_access(area_id, user)
    if body.type not in ("link", "youtube"):
        raise HTTPException(status_code=400, detail="type debe ser link o youtube")

    pool = get_pool()
    with pool.connection() as conn:
        row = conn.execute(
            """
            insert into public.documents
                (area_id, company_id, name, type, source_url, status, uploaded_by)
            values (%s, %s, %s, %s, %s, 'pending', %s)
            returning id
            """,
            (area_id, company_id, body.name, body.type, body.url, user.id),
        ).fetchone()
    document_id = str(row[0])

    background.add_task(process_document, document_id)
    return {"id": document_id, "name": body.name, "type": body.type, "status": "pending"}


@router.get("/areas/{area_id}/documents")
def list_documents(area_id: str, user: CurrentUser = CurrentUserDep) -> list[dict]:
    require_area_access(area_id, user)
    pool = get_pool()
    with pool.connection() as conn:
        rows = conn.execute(
            """
            select id, name, type, status, error_msg, source_url, created_at
            from public.documents where area_id = %s order by created_at desc
            """,
            (area_id,),
        ).fetchall()
    return [
        {
            "id": str(r[0]),
            "name": r[1],
            "type": r[2],
            "status": r[3],
            "error": r[4],
            "source_url": r[5],
            "created_at": r[6].isoformat() if r[6] else None,
        }
        for r in rows
    ]


@router.delete("/documents/{document_id}", status_code=status.HTTP_200_OK)
def delete_document(document_id: str, user: CurrentUser = CurrentUserDep) -> dict:
    pool = get_pool()
    with pool.connection() as conn:
        row = conn.execute(
            "select area_id, storage_path from public.documents where id = %s",
            (document_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Documento no encontrado")
        area_id, storage_path = row
        require_area_access(str(area_id), user)
        conn.execute("delete from public.documents where id = %s", (document_id,))

    if storage_path:
        try:
            get_supabase().storage.from_(_settings.storage_bucket).remove([storage_path])
        except Exception:  # noqa: BLE001  (el archivo puede no existir)
            pass
    return {"deleted": document_id}
