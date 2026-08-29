-- The nightly-autofill edge function was deployed but never actually scheduled —
-- nothing was calling it. Wire up pg_cron + pg_net to hit it once an hour; the
-- function itself filters to users whose autofill_hour matches the current UTC hour,
-- so an hourly tick is what it expects.
--
-- Requires a Vault secret named 'CRON_SECRET' holding the same value as the edge
-- function's CRON_SECRET env var — run once, by hand, in the SQL editor (not here,
-- so the raw value never lands in a git-tracked migration):
--   select vault.create_secret('<same value as the CRON_SECRET edge function secret>', 'CRON_SECRET');
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'nightly-autofill-hourly',
  '5 * * * *', -- 5 minutes past every hour, UTC
  $$
  select net.http_post(
    url := 'https://ubsxdqswauvmnfutkrow.supabase.co/functions/v1/nightly-autofill',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  );
  $$
);
