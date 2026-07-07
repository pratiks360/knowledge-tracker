-- ============================================================
-- Personal Knowledge Graph — Phase 1: Graph core
-- nodes + node_links, RLS, full-text search
-- ============================================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── nodes ─────────────────────────────────────────────────────
create table if not exists public.nodes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  parent_id         uuid null references public.nodes(id) on delete cascade,
  title             text not null,
  description       text,
  notes_md          text,
  status            text not null default 'not_started'
                      check (status in ('not_started', 'learning', 'done')),
  order_index       int not null default 0,
  present_visible   boolean not null default false,
  present_summary   text,
  node_kind         text not null default 'topic'
                      check (node_kind in ('topic', 'project', 'profile_root')),
  recap_md          text,
  last_visited_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  search_tsv        tsvector generated always as (
                      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                      setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
                      setweight(to_tsvector('english', coalesce(notes_md, '')), 'C')
                    ) stored
);

alter table public.nodes enable row level security;

create policy "nodes: owner read"   on public.nodes for select using (auth.uid() = user_id);
create policy "nodes: owner insert" on public.nodes for insert with check (auth.uid() = user_id);
create policy "nodes: owner update" on public.nodes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "nodes: owner delete" on public.nodes for delete using (auth.uid() = user_id);

create trigger nodes_updated_at
  before update on public.nodes
  for each row execute procedure public.set_updated_at();

create index if not exists nodes_user_parent_idx on public.nodes(user_id, parent_id);
create index if not exists nodes_user_parent_order_idx on public.nodes(user_id, parent_id, order_index);
create index if not exists nodes_search_idx on public.nodes using gin(search_tsv);

-- ── node_links ────────────────────────────────────────────────
-- Non-hierarchical relations: related | uses | prerequisite
create table if not exists public.node_links (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  from_node   uuid not null references public.nodes(id) on delete cascade,
  to_node     uuid not null references public.nodes(id) on delete cascade,
  link_type   text not null default 'related'
                check (link_type in ('related', 'uses', 'prerequisite')),
  created_at  timestamptz not null default now(),
  unique (from_node, to_node, link_type)
);

alter table public.node_links enable row level security;

create policy "node_links: owner read"   on public.node_links for select using (auth.uid() = user_id);
create policy "node_links: owner insert" on public.node_links for insert with check (auth.uid() = user_id);
create policy "node_links: owner update" on public.node_links for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "node_links: owner delete" on public.node_links for delete using (auth.uid() = user_id);

create index if not exists node_links_from_idx on public.node_links(user_id, from_node);
create index if not exists node_links_to_idx on public.node_links(user_id, to_node);

-- ── search RPC ────────────────────────────────────────────────
-- Phase 3 will replace this to also union resources.
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
  select
    'node'::text as kind,
    n.id,
    n.id as node_id,
    n.title,
    coalesce(n.description, left(n.notes_md, 160), '') as snippet,
    ts_rank(n.search_tsv, websearch_to_tsquery('english', search_query)) as rank
  from public.nodes n
  where n.user_id = auth.uid()
    and n.search_tsv @@ websearch_to_tsquery('english', search_query)
  order by rank desc
  limit 30
$$;
