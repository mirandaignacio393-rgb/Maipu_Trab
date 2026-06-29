"""Verificación del JWT de Supabase Auth y dependencias de autorización."""
from __future__ import annotations

from dataclasses import dataclass

import jwt
from fastapi import Depends, Header, HTTPException, status

from .clients import get_pool
from .config import get_settings

_settings = get_settings()


@dataclass
class CurrentUser:
    id: str
    email: str | None = None


def get_current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    """Extrae y valida el token Bearer emitido por Supabase Auth."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta el token de autenticación",
        )
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(
            token,
            _settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token inválido: {exc}",
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token sin sub")
    return CurrentUser(id=user_id, email=payload.get("email"))


def require_area_access(area_id: str, user: CurrentUser) -> str:
    """Valida que el usuario pertenezca a la empresa dueña del área.

    Devuelve el company_id del área. Lanza 403 si no tiene acceso.
    """
    pool = get_pool()
    with pool.connection() as conn:
        row = conn.execute(
            """
            select a.company_id
            from public.areas a
            join public.memberships m
              on m.company_id = a.company_id and m.user_id = %s
            where a.id = %s
            """,
            (user.id, area_id),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso al área")
    return str(row[0])


CurrentUserDep = Depends(get_current_user)
