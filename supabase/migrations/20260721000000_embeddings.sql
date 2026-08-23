-- Semantic search: pgvector-backed embeddings over node details/notes and resource
-- summaries, plus the settings needed to pick which configured provider generates them.
create extension if not exists vector;

alter table user_settings
  add column if not exists embedding_provider text check (embedding_provider in ('nvidia', 'cloudflare')),
  add column if not exists embedding_model text,
  add column if not exists embeddings_built_at timestamptz;

create table if not exists content_embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id uuid not null references nodes(id) on delete cascade,
  resource_id uuid references resources(id) on delete cascade,
  kind text not null check (kind in ('node', 'resource')),
  content text not null,
  embedding vector(768) not null,
  updated_at timestamptz not null default now(),
  unique (kind, node_id, resource_id)
);

create index if not exists content_embeddings_user_idx on content_embeddings (user_id);
create index if not exists content_embeddings_vector_idx
  on content_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table content_embeddings enable row level security;

create policy "content_embeddings_select_own" on content_embeddings
  for select using (auth.uid() = user_id);
create policy "content_embeddings_insert_own" on content_embeddings
  for insert with check (auth.uid() = user_id);
create policy "content_embeddings_update_own" on content_embeddings
  for update using (auth.uid() = user_id);
create policy "content_embeddings_delete_own" on content_embeddings
  for delete using (auth.uid() = user_id);

create or replace function match_embeddings(query_embedding vector(768), match_count int default 8)
returns table (
  node_id uuid,
  resource_id uuid,
  kind text,
  content text,
  similarity float
)
language sql stable security definer
set search_path = public
as $$
  select ce.node_id, ce.resource_id, ce.kind, ce.content,
         1 - (ce.embedding <=> query_embedding) as similarity
  from content_embeddings ce
  where ce.user_id = auth.uid()
  order by ce.embedding <=> query_embedding
  limit match_count;
$$;
