-- ============================================================
-- Track when a node's merged "details" write-up was last generated,
-- so the UI can flag it as stale when newer resources are attached.
-- ============================================================

alter table public.nodes
  add column if not exists details_generated_at timestamptz;
