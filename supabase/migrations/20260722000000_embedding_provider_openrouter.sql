-- Semantic search: allow OpenRouter (in addition to NVIDIA/Cloudflare) as the
-- embedding provider, reusing its already-configured chat API key.
alter table user_settings drop constraint if exists user_settings_embedding_provider_check;
alter table user_settings
  add constraint user_settings_embedding_provider_check
  check (embedding_provider in ('openrouter', 'nvidia', 'cloudflare'));
