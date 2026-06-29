"""Clientes externos compartidos: Postgres (pgvector), Supabase, Anthropic, Voyage."""
from __future__ import annotations

from functools import lru_cache

import anthropic
import voyageai
from psycopg_pool import ConnectionPool
from pgvector.psycopg import register_vector
from supabase import Client, create_client

from .config import get_settings

_settings = get_settings()


def _configure_connection(conn) -> None:
    """Registra el tipo vector en cada conexión nueva del pool."""
    register_vector(conn)


@lru_cache
def get_pool() -> ConnectionPool:
    """Pool de conexiones a Postgres de Supabase."""
    pool = ConnectionPool(
        conninfo=_settings.database_url,
        min_size=1,
        max_size=10,
        kwargs={"autocommit": True},
        configure=_configure_connection,
        open=True,
    )
    return pool


@lru_cache
def get_supabase() -> Client:
    """Cliente Supabase con service-role (bypassa RLS, solo para el backend)."""
    return create_client(_settings.supabase_url, _settings.supabase_service_role_key)


@lru_cache
def get_anthropic() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=_settings.anthropic_api_key)


@lru_cache
def get_voyage() -> voyageai.Client:
    return voyageai.Client(api_key=_settings.voyage_api_key)
