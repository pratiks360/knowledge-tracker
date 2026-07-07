-- ============================================================
-- Personal Knowledge Graph — Phase 7: Present mode
-- present_visible / present_summary / node_kind already exist on nodes
-- (added in Phase 1 migration).
-- ============================================================

create table if not exists public.presentations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'default',
  created_at  timestamptz not null default now()
);

alter table public.presentations enable row level security;

create policy "presentations: owner read"   on public.presentations for select using (auth.uid() = user_id);
create policy "presentations: owner insert" on public.presentations for insert with check (auth.uid() = user_id);
create policy "presentations: owner update" on public.presentations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "presentations: owner delete" on public.presentations for delete using (auth.uid() = user_id);

create table if not exists public.story_path_steps (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  presentation_id   uuid not null references public.presentations(id) on delete cascade,
  node_id           uuid not null references public.nodes(id) on delete cascade,
  step_order        int not null default 0,
  unique (presentation_id, node_id)
);

alter table public.story_path_steps enable row level security;

create policy "story_path_steps: owner read"   on public.story_path_steps for select using (auth.uid() = user_id);
create policy "story_path_steps: owner insert" on public.story_path_steps for insert with check (auth.uid() = user_id);
create policy "story_path_steps: owner update" on public.story_path_steps for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "story_path_steps: owner delete" on public.story_path_steps for delete using (auth.uid() = user_id);

create index if not exists story_path_steps_presentation_idx
  on public.story_path_steps(user_id, presentation_id, step_order);
