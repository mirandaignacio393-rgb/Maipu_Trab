"""RAG por área: recuperación vectorial + generación con Claude (con fuentes)."""
from __future__ import annotations

from collections.abc import Iterator

import numpy as np

from ..clients import get_anthropic, get_pool
from ..config import get_settings
from .embeddings import embed_query

_settings = get_settings()

TOP_K = 8

_SYSTEM_BASE = """Sos el asistente de IA especializado del área "{area_name}" de la empresa.
Respondés ÚNICAMENTE con la información del CONTEXTO provisto (documentos de esta área).

Reglas:
- Si la respuesta no está en el contexto, decí claramente que no tenés esa información en esta área. No inventes.
- No mezcles procesos de otras áreas.
- Citá la fuente exacta usando los números entre corchetes, p. ej. [1], [2], al final de cada afirmación basada en un documento.
- Cuando expliques un procedimiento, hacelo paso a paso.
- Respondé en español, claro y conciso.
{area_extra}"""


def retrieve(area_id: str, question: str, k: int = TOP_K) -> list[dict]:
    """Busca los chunks más relevantes del área (aislamiento por area_id)."""
    q_emb = np.array(embed_query(question), dtype=np.float32)
    pool = get_pool()
    with pool.connection() as conn:
        rows = conn.execute(
            "select * from public.match_chunks(%s, %s, %s)",
            (q_emb, area_id, k),
        ).fetchall()
    results = []
    for r in rows:
        cid, document_id, content, metadata, similarity = r
        results.append(
            {
                "chunk_id": str(cid),
                "document_id": str(document_id),
                "content": content,
                "document_name": (metadata or {}).get("document_name", "documento"),
                "similarity": float(similarity),
            }
        )
    return results


def _build_context(chunks: list[dict]) -> str:
    blocks = []
    for i, c in enumerate(chunks, start=1):
        blocks.append(f"[{i}] (Documento: {c['document_name']})\n{c['content']}")
    return "\n\n---\n\n".join(blocks)


def _system_prompt(area_name: str, area_extra: str | None) -> str:
    return _SYSTEM_BASE.format(area_name=area_name, area_extra=(area_extra or "").strip())


def answer_stream(
    *,
    area_id: str,
    area_name: str,
    area_system_prompt: str | None,
    question: str,
    history: list[dict] | None = None,
) -> Iterator[dict]:
    """Genera la respuesta en streaming.

    Produce eventos: {"type": "sources", ...}, {"type": "delta", ...}, {"type": "done", ...}.
    """
    chunks = retrieve(area_id, question)

    sources = [
        {
            "index": i + 1,
            "document_id": c["document_id"],
            "document_name": c["document_name"],
            "similarity": round(c["similarity"], 4),
        }
        for i, c in enumerate(chunks)
    ]
    yield {"type": "sources", "sources": sources}

    if not chunks:
        msg = "No encontré información sobre eso en los documentos de esta área."
        yield {"type": "delta", "text": msg}
        yield {"type": "done", "text": msg, "sources": []}
        return

    context = _build_context(chunks)
    system = _system_prompt(area_name, area_system_prompt)

    messages: list[dict] = []
    for turn in history or []:
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append(
        {
            "role": "user",
            "content": f"CONTEXTO:\n{context}\n\n---\n\nPREGUNTA:\n{question}",
        }
    )

    client = get_anthropic()
    full: list[str] = []
    with client.messages.stream(
        model=_settings.anthropic_model,
        max_tokens=2000,
        system=system,
        messages=messages,
    ) as stream:
        for text in stream.text_stream:
            full.append(text)
            yield {"type": "delta", "text": text}

    answer = "".join(full)
    yield {"type": "done", "text": answer, "sources": sources}
