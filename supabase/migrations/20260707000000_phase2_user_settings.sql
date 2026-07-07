-- ============================================================
-- Personal Knowledge Graph — Phase 2: user_settings
-- Stores the user's own OpenRouter API key + selected model.
-- ============================================================

create table if not exists public.user_settings (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  openrouter_api_key  text,
  selected_model      text,
  owner_email         text,
  updated_at          timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "user_settings: owner read"   on public.user_settings for select using (auth.uid() = user_id);
create policy "user_settings: owner insert" on public.user_settings for insert with check (auth.uid() = user_id);
create policy "user_settings: owner update" on public.user_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_settings: owner delete" on public.user_settings for delete using (auth.uid() = user_id);

create trigger user_settings_updated_at
  before update on public.user_settings
  for each row execute procedure public.set_updated_at();
