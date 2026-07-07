-- ============================================================
-- Persistent AI-generated detail write-up per node.
-- "Generate details" saves straight here so it survives reloads.
-- ============================================================

alter table public.nodes
  add column if not exists details_md text;
