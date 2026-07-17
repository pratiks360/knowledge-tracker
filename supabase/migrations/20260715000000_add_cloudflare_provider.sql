-- ============================================================
-- Add Cloudflare Workers AI as a third AI provider.
-- Unlike the others, Cloudflare's OpenAI-compatible endpoint is
-- account-scoped (the account id is part of the URL), so we store
-- an account id alongside the token + manually-entered model id.
-- ============================================================

-- Widen the ai_provider check to include 'cloudflare'.
alter table public.user_settings
  drop constraint if exists user_settings_ai_provider_check;

alter table public.user_settings
  add constraint user_settings_ai_provider_check
    check (ai_provider in ('openrouter', 'nvidia', 'cloudflare'));

alter table public.user_settings
  add column if not exists cloudflare_api_key text,
  add column if not exists cloudflare_account_id text,
  add column if not exists cloudflare_model text;
