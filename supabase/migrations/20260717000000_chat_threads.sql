-- ============================================================
-- Personal Knowledge Graph — Coach chat threads
-- Multiple named conversations on the dashboard, instead of one.
-- ============================================================

create table if not exists public.chat_threads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'New chat',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.chat_threads enable row level security;

create policy "chat_threads: owner read"   on public.chat_threads for select using (auth.uid() = user_id);
create policy "chat_threads: owner insert" on public.chat_threads for insert with check (auth.uid() = user_id);
create policy "chat_threads: owner update" on public.chat_threads for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "chat_threads: owner delete" on public.chat_threads for delete using (auth.uid() = user_id);

drop trigger if exists chat_threads_updated_at on public.chat_threads;
create trigger chat_threads_updated_at
  before update on public.chat_threads
  for each row execute procedure public.set_updated_at();

-- Tabs are ordered most-recently-used first.
create index if not exists chat_threads_user_idx on public.chat_threads(user_id, updated_at desc);

-- ── Attach messages to threads ────────────────────────────────
-- Coach messages carry node_id NULL + thread_id set; per-topic messages keep
-- node_id set + thread_id NULL. Deleting a thread takes its messages with it.
alter table public.chat_messages
  add column if not exists thread_id uuid references public.chat_threads(id) on delete cascade;

create index if not exists chat_messages_thread_idx
  on public.chat_messages(user_id, thread_id, created_at)
  where thread_id is not null;

-- Backfill: the coach conversation that already exists predates threads, so give
-- each user's orphaned messages a home rather than stranding them.
do $$
declare
  u record;
  t uuid;
begin
  for u in
    select distinct user_id
    from public.chat_messages
    where node_id is null and thread_id is null
  loop
    insert into public.chat_threads (user_id, title)
    values (u.user_id, 'Coach')
    returning id into t;

    update public.chat_messages
    set thread_id = t
    where user_id = u.user_id and node_id is null and thread_id is null;
  end loop;
end $$;
