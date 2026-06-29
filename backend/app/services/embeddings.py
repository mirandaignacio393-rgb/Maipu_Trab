"""Generación de embeddings con Voyage AI."""
from __future__ import annotations

from ..clients import get_voyage
from ..config import get_settings

_settings = get_settings()
_MAX_BATCH = 128


def embed_documents(texts: list[str]) -> list[list[float]]:
    """Embeddings para fragmentos a indexar (input_type='document')."""
    client = get_voyage()
    out: list[list[float]] = []
    for i in range(0, len(texts), _MAX_BATCH):
        batch = texts[i : i + _MAX_BATCH]
        res = client.embed(batch, model=_settings.voyage_model, input_type="document")
        out.extend(res.embeddings)
    return out


def embed_query(text: str) -> list[float]:
    """Embedding de una consulta de búsqueda (input_type='query')."""
    client = get_voyage()
    res = client.embed([text], model=_settings.voyage_model, input_type="query")
    return res.embeddings[0]
