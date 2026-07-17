-- ============================================================
-- Personal Knowledge Graph — Dashboard chat + topic tags
-- ============================================================

-- ── Dashboard chat ────────────────────────────────────────────
-- The dashboard has a graph-wide chat (progress, motivation, roadmap planning)
-- that isn't attached to any one topic. Those messages are chat_messages rows
-- with node_id NULL; per-topic threads keep a non-null node_id as before.
alter table public.chat_messages alter column node_id drop not null;

-- Partial index for the global thread — the composite (user_id, node_id, created_at)
-- index can't serve `node_id is null` scans efficiently.
create index if not exists chat_messages_global_idx
  on public.chat_messages(user_id, created_at)
  where node_id is null;

-- ── Topic tags ────────────────────────────────────────────────
alter table public.nodes add column if not exists tags text[] not null default '{}';

-- search_tsv is a generated column, so including tags means dropping and
-- recreating it (and the GIN index that hangs off it). Tags get weight A —
-- a tag is a deliberate label, so it should rank alongside the title rather
-- than below the description.
-- array_to_string() is only STABLE (it depends on the element type's output function),
-- and a generated column's expression must be IMMUTABLE. For text[] the conversion
-- genuinely is immutable, so wrap it in a function marked as such.
create or replace function public.tags_to_text(tags text[])
returns text
language sql
immutable
parallel safe
as $$ select coalesce(array_to_string(tags, ' '), '') $$;

-- Written to be re-runnable: if a partial run left search_tsv in place, this drops
-- and rebuilds it rather than failing with "column already exists".
drop index if exists nodes_search_idx;
alter table public.nodes drop column if exists search_tsv;
alter table public.nodes add column search_tsv tsvector generated always as (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', public.tags_to_text(tags)), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(notes_md, '')), 'C')
) stored;
create index if not exists nodes_search_idx on public.nodes using gin(search_tsv);

-- Supports exact tag filtering (`tags @> '{security}'`) independent of full-text ranking.
create index if not exists nodes_tags_idx on public.nodes using gin(tags);
