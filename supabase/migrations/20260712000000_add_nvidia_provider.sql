-- ============================================================
-- Add NVIDIA NIM as a second AI provider alongside OpenRouter.
-- Each provider keeps its own key + selected model; ai_provider
-- picks which pair the app uses.
-- ============================================================

alter table public.user_settings
  add column if not exists ai_provider text not null default 'openrouter'
    check (ai_provider in ('openrouter', 'nvidia')),
  add column if not exists nvidia_api_key text,
  add column if not exists nvidia_model text;
