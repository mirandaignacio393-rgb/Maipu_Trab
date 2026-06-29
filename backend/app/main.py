"""Punto de entrada de la API (FastAPI)."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import areas, chat, documents

_settings = get_settings()

app = FastAPI(
    title="Plataforma de Conocimiento con IA por Áreas",
    version="0.1.0",
    description="Backend RAG: cada área tiene su propia IA entrenada con su documentación.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(areas.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
