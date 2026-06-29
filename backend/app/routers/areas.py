"""Endpoints de empresas y áreas."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from ..auth import CurrentUser, CurrentUserDep, require_area_access
from ..clients import get_pool

router = APIRouter(tags=["areas"])


# --------------------------- modelos ---------------------------
class CompanyIn(BaseModel):
    name: str


class AreaIn(BaseModel):
    company_id: str
    name: str
    description: str | None = None
    system_prompt: str | None = None


# --------------------------- empresas ---------------------------
@router.post("/companies", status_code=status.HTTP_201_CREATED)
def create_company(body: CompanyIn, user: CurrentUser = CurrentUserDep) -> dict:
    pool = get_pool()
    with pool.connection() as conn:
        with conn.transaction():
            row = conn.execute(
                "insert into public.companies (name, owner_id) values (%s, %s) returning id",
                (body.name, user.id),
            ).fetchone()
            company_id = row[0]
            conn.execute(
                """
                insert into public.memberships (company_id, user_id, role)
                values (%s, %s, 'owner')
                """,
                (company_id, user.id),
            )
    return {"id": str(company_id), "name": body.name}


@router.get("/companies")
def list_companies(user: CurrentUser = CurrentUserDep) -> list[dict]:
    pool = get_pool()
    with pool.connection() as conn:
        rows = conn.execute(
            """
            select c.id, c.name, m.role
            from public.companies c
            join public.memberships m on m.company_id = c.id
            where m.user_id = %s
            order by c.created_at
            """,
            (user.id,),
        ).fetchall()
    return [{"id": str(r[0]), "name": r[1], "role": r[2]} for r in rows]


# --------------------------- áreas ---------------------------
def _assert_company_admin(company_id: str, user: CurrentUser) -> None:
    pool = get_pool()
    with pool.connection() as conn:
        row = conn.execute(
            """
            select role from public.memberships
            where company_id = %s and user_id = %s
            """,
            (company_id, user.id),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=403, detail="Sin acceso a la empresa")
    if row[0] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Se requiere rol admin/owner")


@router.post("/areas", status_code=status.HTTP_201_CREATED)
def create_area(body: AreaIn, user: CurrentUser = CurrentUserDep) -> dict:
    _assert_company_admin(body.company_id, user)
    pool = get_pool()
    with pool.connection() as conn:
        row = conn.execute(
            """
            insert into public.areas (company_id, name, description, system_prompt)
            values (%s, %s, %s, %s) returning id
            """,
            (body.company_id, body.name, body.description, body.system_prompt),
        ).fetchone()
    return {"id": str(row[0]), "name": body.name}


@router.get("/companies/{company_id}/areas")
def list_areas(company_id: str, user: CurrentUser = CurrentUserDep) -> list[dict]:
    pool = get_pool()
    with pool.connection() as conn:
        # valida pertenencia
        member = conn.execute(
            "select 1 from public.memberships where company_id = %s and user_id = %s",
            (company_id, user.id),
        ).fetchone()
        if not member:
            raise HTTPException(status_code=403, detail="Sin acceso a la empresa")
        rows = conn.execute(
            """
            select id, name, description
            from public.areas where company_id = %s order by created_at
            """,
            (company_id,),
        ).fetchall()
    return [{"id": str(r[0]), "name": r[1], "description": r[2]} for r in rows]


@router.get("/areas/{area_id}")
def get_area(area_id: str, user: CurrentUser = CurrentUserDep) -> dict:
    require_area_access(area_id, user)
    pool = get_pool()
    with pool.connection() as conn:
        row = conn.execute(
            "select id, company_id, name, description, system_prompt from public.areas where id = %s",
            (area_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Área no encontrada")
    return {
        "id": str(row[0]),
        "company_id": str(row[1]),
        "name": row[2],
        "description": row[3],
        "system_prompt": row[4],
    }
