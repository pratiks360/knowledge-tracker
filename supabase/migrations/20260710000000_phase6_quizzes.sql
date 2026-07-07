-- ============================================================
-- Personal Knowledge Graph — Phase 6: Recall loop (quizzes)
-- recap_md already exists on nodes (added in Phase 1 migration).
-- ============================================================

create table if not exists public.quizzes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  node_id     uuid not null references public.nodes(id) on delete cascade,
  questions   jsonb not null,
  last_score  int,
  taken_at    timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.quizzes enable row level security;

create policy "quizzes: owner read"   on public.quizzes for select using (auth.uid() = user_id);
create policy "quizzes: owner insert" on public.quizzes for insert with check (auth.uid() = user_id);
create policy "quizzes: owner update" on public.quizzes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "quizzes: owner delete" on public.quizzes for delete using (auth.uid() = user_id);

create index if not exists quizzes_node_idx on public.quizzes(user_id, node_id, created_at desc);
