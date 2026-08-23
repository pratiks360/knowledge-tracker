-- ============================================================
-- Nightly auto-fill: use leftover free AI credits to generate
-- details for topics that don't have any yet. Rotates across
-- all configured providers (OpenRouter / NVIDIA / Cloudflare).
-- ============================================================

alter table public.user_settings
  add column if not exists autofill_enabled boolean not null default false,
  add column if not exists autofill_hour int not null default 2,        -- UTC hour to run
  add column if not exists autofill_max_per_run int not null default 20, -- cap per night
  add column if not exists autofill_last_run timestamptz,
  add column if not exists autofill_last_count int,
  add column if not exists autofill_last_status text;                    -- ok | rate_limited | error

-- Index the work queue: topics with no details yet.
create index if not exists nodes_needs_details_idx
  on public.nodes(user_id)
  where details_md is null;
