"""Endpoint de chat RAG por área (respuesta en streaming vía SSE)."""
from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..auth import CurrentUser, CurrentUserDep, require_area_access
from ..clients import get_pool
from ..services import rag

router = APIRouter(tags=["chat"])


class ChatIn(BaseModel):
    question: str
    conversation_id: str | None = None


def _area_info(area_id: str) -> tuple[str, str | None]:
    pool = get_pool()
    with pool.connection() as conn:
        row = conn.execute(
            "select name, system_prompt from public.areas where id = %s",
            (area_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Área no encontrada")
    return row[0], row[1]


def _get_or_create_conversation(area_id: str, user_id: str, conversation_id: str | None, title: str) -> str:
    pool = get_pool()
    with pool.connection() as conn:
        if conversation_id:
            row = conn.execute(
                "select id from public.conversations where id = %s and user_id = %s",
                (conversation_id, user_id),
            ).fetchone()
            if row:
                return str(row[0])
        row = conn.execute(
            "insert into public.conversations (area_id, user_id, title) values (%s, %s, %s) returning id",
            (area_id, user_id, title[:80]),
        ).fetchone()
    return str(row[0])


def _load_history(conversation_id: str, limit: int = 10) -> list[dict]:
    pool = get_pool()
    with pool.connection() as conn:
        rows = conn.execute(
            """
            select role, content from public.messages
            where conversation_id = %s order by created_at desc limit %s
            """,
            (conversation_id, limit),
        ).fetchall()
    return [{"role": r[0], "content": r[1]} for r in reversed(rows)]


def _save_message(conversation_id: str, role: str, content: str, citations: list | None = None) -> None:
    pool = get_pool()
    with pool.connection() as conn:
        conn.execute(
            "insert into public.messages (conversation_id, role, content, citations) values (%s, %s, %s, %s)",
            (conversation_id, role, content, json.dumps(citations or [])),
        )


@router.post("/areas/{area_id}/chat")
def chat(area_id: str, body: ChatIn, user: CurrentUser = CurrentUserDep) -> StreamingResponse:
    require_area_access(area_id, user)
    area_name, area_prompt = _area_info(area_id)

    conversation_id = _get_or_create_conversation(
        area_id, user.id, body.conversation_id, body.question
    )
    history = _load_history(conversation_id)
    _save_message(conversation_id, "user", body.question)

    def event_stream():
        # Primer evento: id de la conversación
        yield f"data: {json.dumps({'type': 'conversation', 'conversation_id': conversation_id})}\n\n"

        final_text = ""
        final_sources: list = []
        for ev in rag.answer_stream(
            area_id=area_id,
            area_name=area_name,
            area_system_prompt=area_prompt,
            question=body.question,
            history=history,
        ):
            if ev["type"] == "done":
                final_text = ev["text"]
                final_sources = ev["sources"]
            yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"

        # Persistir la respuesta del asistente
        _save_message(conversation_id, "assistant", final_text, final_sources)
        yield f"data: {json.dumps({'type': 'end'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
