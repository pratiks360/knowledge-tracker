-- Tracks which topics the last nightly-autofill run actually filled, so
-- Settings can show a "what got filled" list with links back to each topic.
alter table user_settings
  add column if not exists autofill_last_filled jsonb not null default '[]'::jsonb;
