-- ============================================================
--  Plataforma de Conocimiento con IA por Áreas
--  Migración inicial: schema multi-tenant + pgvector
-- ============================================================

-- Extensiones
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "vector";      -- pgvector

-- ------------------------------------------------------------
--  Empresas (tenant raíz)
-- ------------------------------------------------------------
create table if not exists public.companies (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    owner_id    uuid not null references auth.users (id) on delete restrict,
    created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
--  Perfiles (extiende auth.users)
-- ------------------------------------------------------------
create table if not exists public.profiles (
    id          uuid primary key references auth.users (id) on delete cascade,
    full_name   text,
    avatar_url  text,
    created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
--  Membresías: vincula usuarios a empresas con un rol global
--  role: owner | admin | member
-- ------------------------------------------------------------
create table if not exists public.memberships (
    id          uuid primary key default gen_random_uuid(),
    company_id  uuid not null references public.companies (id) on delete cascade,
    user_id     uuid not null references auth.users (id) on delete cascade,
    role        text not null default 'member' check (role in ('owner', 'admin', 'member')),
    created_at  timestamptz not null default now(),
    unique (company_id, user_id)
);
create index if not exists idx_memberships_user on public.memberships (user_id);
create index if not exists idx_memberships_company on public.memberships (company_id);

-- ------------------------------------------------------------
--  Áreas / Departamentos (creación ilimitada por empresa)
-- ------------------------------------------------------------
create table if not exists public.areas (
    id          uuid primary key default gen_random_uuid(),
    company_id  uuid not null references public.companies (id) on delete cascade,
    name        text not null,
    description text,
    -- Prompt de sistema específico del área (personaliza la IA de cada área)
    system_prompt text,
    created_at  timestamptz not null default now()
);
create index if not exists idx_areas_company on public.areas (company_id);

-- ------------------------------------------------------------
--  Administradores por área (permisos personalizados)
-- ------------------------------------------------------------
create table if not exists public.area_admins (
    area_id     uuid not null references public.areas (id) on delete cascade,
    user_id     uuid not null references auth.users (id) on delete cascade,
    created_at  timestamptz not null default now(),
    primary key (area_id, user_id)
);

-- ------------------------------------------------------------
--  Acceso de miembros a áreas (permisos finos: quién ve qué área)
-- ------------------------------------------------------------
create table if not exists public.area_members (
    area_id     uuid not null references public.areas (id) on delete cascade,
    user_id     uuid not null references auth.users (id) on delete cascade,
    created_at  timestamptz not null default now(),
    primary key (area_id, user_id)
);

-- ------------------------------------------------------------
--  Documentos (base de conocimiento)
--  type: pdf | docx | xlsx | pptx | image | youtube | link | text
--  status: pending | processing | ready | error
-- ------------------------------------------------------------
create table if not exists public.documents (
    id           uuid primary key default gen_random_uuid(),
    area_id      uuid not null references public.areas (id) on delete cascade,
    company_id   uuid not null references public.companies (id) on delete cascade,
    name         text not null,
    type         text not null,
    storage_path text,            -- ruta en Supabase Storage (archivos)
    source_url   text,            -- para links / videos de YouTube o nube
    status       text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'error')),
    error_msg    text,
    uploaded_by  uuid references auth.users (id) on delete set null,
    created_at   timestamptz not null default now()
);
create index if not exists idx_documents_area on public.documents (area_id);

-- ------------------------------------------------------------
--  Chunks + embeddings (vector(1024) para voyage-3)
--  area_id está desnormalizado para poder filtrar la búsqueda
--  vectorial por área SIN un join (clave del aislamiento por área).
-- ------------------------------------------------------------
create table if not exists public.document_chunks (
    id           uuid primary key default gen_random_uuid(),
    document_id  uuid not null references public.documents (id) on delete cascade,
    area_id      uuid not null references public.areas (id) on delete cascade,
    chunk_index  int not null,
    content      text not null,
    embedding    vector(1024),
    metadata     jsonb not null default '{}'::jsonb,
    created_at   timestamptz not null default now()
);
create index if not exists idx_chunks_area on public.document_chunks (area_id);
create index if not exists idx_chunks_document on public.document_chunks (document_id);
-- Índice ANN (coseno) para búsqueda vectorial rápida
create index if not exists idx_chunks_embedding
    on public.document_chunks
    using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);

-- ------------------------------------------------------------
--  Conversaciones + mensajes (historial del chat por área)
-- ------------------------------------------------------------
create table if not exists public.conversations (
    id          uuid primary key default gen_random_uuid(),
    area_id     uuid not null references public.areas (id) on delete cascade,
    user_id     uuid not null references auth.users (id) on delete cascade,
    title       text,
    created_at  timestamptz not null default now()
);
create index if not exists idx_conversations_area on public.conversations (area_id);
create index if not exists idx_conversations_user on public.conversations (user_id);

create table if not exists public.messages (
    id              uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations (id) on delete cascade,
    role            text not null check (role in ('user', 'assistant')),
    content         text not null,
    citations       jsonb not null default '[]'::jsonb,  -- fuentes exactas usadas en la respuesta
    created_at      timestamptz not null default now()
);
create index if not exists idx_messages_conversation on public.messages (conversation_id);

-- ============================================================
--  Función de búsqueda vectorial filtrada por área
--  (el aislamiento por área se garantiza acá: WHERE area_id = p_area_id)
-- ============================================================
create or replace function public.match_chunks (
    query_embedding vector(1024),
    p_area_id       uuid,
    match_count     int default 8
)
returns table (
    id          uuid,
    document_id uuid,
    content     text,
    metadata    jsonb,
    similarity  float
)
language sql stable
as $$
    select
        c.id,
        c.document_id,
        c.content,
        c.metadata,
        1 - (c.embedding <=> query_embedding) as similarity
    from public.document_chunks c
    where c.area_id = p_area_id
      and c.embedding is not null
    order by c.embedding <=> query_embedding
    limit match_count;
$$;

-- ============================================================
--  Row Level Security
--  El backend usa la SERVICE_ROLE key (bypassa RLS) para la
--  ingesta y el RAG. Estas policies protegen el acceso directo
--  desde el frontend con la anon key.
-- ============================================================

-- Helper: ¿el usuario actual pertenece a esta empresa?
create or replace function public.is_company_member (p_company_id uuid)
returns boolean
language sql stable security definer
as $$
    select exists (
        select 1 from public.memberships m
        where m.company_id = p_company_id and m.user_id = auth.uid()
    );
$$;

alter table public.companies        enable row level security;
alter table public.profiles         enable row level security;
alter table public.memberships      enable row level security;
alter table public.areas            enable row level security;
alter table public.area_admins      enable row level security;
alter table public.area_members     enable row level security;
alter table public.documents        enable row level security;
alter table public.document_chunks  enable row level security;
alter table public.conversations    enable row level security;
alter table public.messages         enable row level security;

-- Perfiles: cada quien ve/edita el suyo
create policy "own profile" on public.profiles
    for all using (id = auth.uid()) with check (id = auth.uid());

-- Empresas: visibles para sus miembros
create policy "company members read" on public.companies
    for select using (public.is_company_member(id));

-- Membresías: el usuario ve las propias
create policy "own memberships" on public.memberships
    for select using (user_id = auth.uid());

-- Áreas: visibles para miembros de la empresa
create policy "areas read by company member" on public.areas
    for select using (public.is_company_member(company_id));

-- Documentos: visibles para miembros de la empresa dueña del área
create policy "documents read by company member" on public.documents
    for select using (public.is_company_member(company_id));

-- Conversaciones / mensajes: solo del propio usuario
create policy "own conversations" on public.conversations
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own messages" on public.messages
    for all using (
        exists (
            select 1 from public.conversations cv
            where cv.id = conversation_id and cv.user_id = auth.uid()
        )
    );
