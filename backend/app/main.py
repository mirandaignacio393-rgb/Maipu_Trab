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


@app.get("/api/health/config")
def health_config() -> dict:
    """Diagnóstico: muestra qué variables están cargadas (sin exponer secretos)."""
    return {
        "supabase_url": _settings.supabase_url,
        "cors_origins": _settings.cors_origins,
        "has_database_url": bool(_settings.database_url),
        "has_jwt_secret": bool(_settings.supabase_jwt_secret),
        "has_service_role": bool(_settings.supabase_service_role_key),
        "has_anon_key": bool(_settings.supabase_anon_key),
        "has_anthropic_key": bool(_settings.anthropic_api_key),
        "has_voyage_key": bool(_settings.voyage_api_key),
        "storage_bucket": _settings.storage_bucket,
    }


@app.get("/api/health/db")
def health_db() -> dict:
    """Diagnóstico: prueba la conexión a la base de datos."""
    from .clients import get_pool

    try:
        pool = get_pool()
        with pool.connection() as conn:
            conn.execute("select 1")
        return {"db": "ok"}
    except Exception as exc:  # noqa: BLE001
        return {"db": "error", "detail": str(exc)[:600]}
