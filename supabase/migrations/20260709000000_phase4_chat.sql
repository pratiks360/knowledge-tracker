-- ============================================================
-- Personal Knowledge Graph — Phase 4: Per-node chat
-- ============================================================

create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  node_id     uuid not null references public.nodes(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "chat_messages: owner read"   on public.chat_messages for select using (auth.uid() = user_id);
create policy "chat_messages: owner insert" on public.chat_messages for insert with check (auth.uid() = user_id);
create policy "chat_messages: owner delete" on public.chat_messages for delete using (auth.uid() = user_id);

create index if not exists chat_messages_node_idx on public.chat_messages(user_id, node_id, created_at);
