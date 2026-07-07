-- ============================================================
-- Personal Knowledge Graph — Phase 3: Resources & ingestion
-- ============================================================

create table if not exists public.resources (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  node_id      uuid not null references public.nodes(id) on delete cascade,
  kind         text not null check (kind in ('web', 'youtube', 'manual')),
  url          text,
  title        text,
  raw_content  text,
  summary_md   text,
  pinned       boolean not null default false,
  created_at   timestamptz not null default now(),
  search_tsv   tsvector generated always as (
                 setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                 setweight(to_tsvector('english', coalesce(summary_md, '')), 'B') ||
                 setweight(to_tsvector('english', coalesce(raw_content, '')), 'C')
               ) stored
);

alter table public.resources enable row level security;

create policy "resources: owner read"   on public.resources for select using (auth.uid() = user_id);
create policy "resources: owner insert" on public.resources for insert with check (auth.uid() = user_id);
create policy "resources: owner update" on public.resources for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "resources: owner delete" on public.resources for delete using (auth.uid() = user_id);

create index if not exists resources_node_idx on public.resources(user_id, node_id);
create index if not exists resources_search_idx on public.resources using gin(search_tsv);

-- ── search RPC (replaces Phase 1 version — now unions nodes + resources) ──
create or replace function public.search_all(search_query text)
returns table (
  kind text,
  id uuid,
  node_id uuid,
  title text,
  snippet text,
  rank real
)
language sql
stable
security invoker
as $$
  select 'node'::text as kind, n.id, n.id as node_id, n.title,
    coalesce(n.description, left(n.notes_md, 160), '') as snippet,
    ts_rank(n.search_tsv, websearch_to_tsquery('english', search_query)) as rank
  from public.nodes n
  where n.user_id = auth.uid()
    and n.search_tsv @@ websearch_to_tsquery('english', search_query)

  union all

  select 'resource'::text as kind, r.id, r.node_id, coalesce(r.title, r.url, 'Untitled resource'),
    coalesce(left(r.summary_md, 160), left(r.raw_content, 160), '') as snippet,
    ts_rank(r.search_tsv, websearch_to_tsquery('english', search_query)) as rank
  from public.resources r
  where r.user_id = auth.uid()
    and r.search_tsv @@ websearch_to_tsquery('english', search_query)

  order by rank desc
  limit 30
$$;
