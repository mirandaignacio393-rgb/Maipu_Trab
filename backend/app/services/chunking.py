"""Troceado (chunking) de texto para indexar en la base vectorial."""
from __future__ import annotations

import re

# ~800 palabras por chunk con solape de ~120 da buen balance recall/precisión.
DEFAULT_CHUNK_WORDS = 800
DEFAULT_OVERLAP_WORDS = 120


def chunk_text(
    text: str,
    chunk_words: int = DEFAULT_CHUNK_WORDS,
    overlap_words: int = DEFAULT_OVERLAP_WORDS,
) -> list[str]:
    """Divide el texto en fragmentos solapados, respetando límites de palabra."""
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []

    words = text.split(" ")
    if len(words) <= chunk_words:
        return [text]

    step = max(1, chunk_words - overlap_words)
    chunks: list[str] = []
    for start in range(0, len(words), step):
        piece = " ".join(words[start : start + chunk_words]).strip()
        if piece:
            chunks.append(piece)
        if start + chunk_words >= len(words):
            break
    return chunks
