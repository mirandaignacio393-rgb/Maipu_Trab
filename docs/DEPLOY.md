# Notas de Deploy

Arquitectura en producción:

- **Frontend (Next.js)** → Railway · servicio `frontend` · Root Directory `frontend`
- **Backend (FastAPI)** → Railway · servicio `backend` · Root Directory `backend`
- **Datos / Auth / Storage** → Supabase (proyecto `ynamibpxjulwefxjgklp`)

## Variables de entorno

### Backend (Railway)
`PORT`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_JWT_SECRET`, `DATABASE_URL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`,
`VOYAGE_API_KEY`, `VOYAGE_MODEL`, `VOYAGE_EMBED_DIM`, `STORAGE_BUCKET`,
`BACKEND_CORS_ORIGINS`.

### Frontend (Railway) — se hornean en el build
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_API_URL`, `PORT`.

> Las variables `NEXT_PUBLIC_*` se incrustan durante el build: si se cambian,
> hay que **Redeploy** del frontend para que tomen efecto.
