# Plataforma de Conocimiento con IA por Áreas

Cada área de una empresa tiene su **propio asistente de IA**, entrenado exclusivamente
con la documentación de ese departamento. La IA responde **solo** con la información del
área consultada (sin mezclar procesos), citando la **fuente exacta**.

## Arquitectura

```
Next.js (UI)  ──HTTP + JWT──►  FastAPI (Python: RAG, parseo, embeddings, Claude)
     │                               │
     └── Supabase Auth ──────────────┤── Supabase Postgres + pgvector (datos)
                                      └── Supabase Storage (archivos crudos)
```

- **Frontend** (`/frontend`): Next.js 15 + TypeScript + Tailwind. Login, árbol Empresa→Áreas,
  carga de documentos y chat por área con streaming y fuentes.
- **Backend** (`/backend`): FastAPI. Parseo de PDF/Word/Excel/PPT/imágenes, chunking,
  embeddings (Voyage AI) y chat RAG con Claude Opus 4.8.
- **Datos** (`/supabase`): esquema multi-tenant + pgvector + función `match_chunks`.

El **aislamiento por área** se garantiza en la búsqueda vectorial: cada chunk lleva
`area_id` y la consulta filtra `WHERE area_id = ?` (no es solo un prompt).

## Puesta en marcha

### 1. Variables de entorno
```bash
cp .env.example .env   # completá tus keys de Supabase, Anthropic y Voyage
```

### 2. Supabase
1. Creá un proyecto en Supabase.
2. SQL Editor → pegá y ejecutá `supabase/migrations/001_init.sql`.
3. Storage → creá un bucket privado llamado `knowledge-docs` (o el valor de `STORAGE_BUCKET`).

### 3. Backend
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 4. Frontend
```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

## Flujo de uso
1. Registrate / iniciá sesión.
2. Creá una **empresa** y dentro tantas **áreas** como necesites (RR.HH., Marketing, …).
3. En cada área, subí documentos (PDF, Word, Excel, PPT, imágenes) o agregá links.
4. Preguntale al chat del área: responde con su documentación y muestra las fuentes.

## Niveles de IA (roadmap)
- **Nivel 1** (implementado): responde preguntas con citas.
- **Nivel 2**: guía procesos completos paso a paso (la base ya está; se refuerza con prompts).
- **Nivel 3**: automatiza acciones (integraciones / tool-use).

## Estructura
```
backend/   FastAPI (RAG, parseo, embeddings, Claude)
frontend/  Next.js (UI)
supabase/  Migraciones SQL (schema + pgvector)
```
