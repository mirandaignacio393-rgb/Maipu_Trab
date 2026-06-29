"""Pipeline de ingesta: descarga -> parseo -> chunking -> embeddings -> pgvector."""
from __future__ import annotations

import numpy as np

from ..clients import get_pool, get_supabase
from ..config import get_settings
from .chunking import chunk_text
from .embeddings import embed_documents
from .parsing import extract_text

_settings = get_settings()


def _set_status(document_id: str, status: str, error: str | None = None) -> None:
    pool = get_pool()
    with pool.connection() as conn:
        conn.execute(
            "update public.documents set status = %s, error_msg = %s where id = %s",
            (status, error, document_id),
        )


def _download_from_storage(storage_path: str) -> bytes:
    sb = get_supabase()
    return sb.storage.from_(_settings.storage_bucket).download(storage_path)


def process_document(document_id: str) -> dict:
    """Procesa un documento ya registrado en la tabla `documents`.

    Pensado para ejecutarse en background (BackgroundTasks).
    """
    pool = get_pool()
    with pool.connection() as conn:
        row = conn.execute(
            """
            select id, area_id, name, type, storage_path, source_url
            from public.documents where id = %s
            """,
            (document_id,),
        ).fetchone()

    if not row:
        raise ValueError("Documento inexistente")

    _, area_id, name, doc_type, storage_path, source_url = row
    _set_status(document_id, "processing")

    try:
        data = _download_from_storage(storage_path) if storage_path else None
        text = extract_text(
            doc_type=doc_type,
            filename=name,
            data=data,
            source_url=source_url,
        )
        chunks = chunk_text(text)
        if not chunks:
            _set_status(document_id, "ready")
            return {"document_id": document_id, "chunks": 0}

        embeddings = embed_documents(chunks)

        with pool.connection() as conn:
            # Reemplaza chunks previos (re-indexación idempotente)
            conn.execute(
                "delete from public.document_chunks where document_id = %s",
                (document_id,),
            )
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    insert into public.document_chunks
                        (document_id, area_id, chunk_index, content, embedding, metadata)
                    values (%s, %s, %s, %s, %s, %s)
                    """,
                    [
                        (
                            document_id,
                            str(area_id),
                            idx,
                            chunk,
                            np.array(emb, dtype=np.float32),
                            {"document_name": name, "chunk_index": idx},
                        )
                        for idx, (chunk, emb) in enumerate(zip(chunks, embeddings))
                    ],
                )

        _set_status(document_id, "ready")
        return {"document_id": document_id, "chunks": len(chunks)}

    except Exception as exc:  # noqa: BLE001
        _set_status(document_id, "error", str(exc)[:500])
        raise
