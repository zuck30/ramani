-- Rate limiting for the ramani-chat edge function.
--
-- Run once in the Supabase SQL editor. The script is idempotent.
--
-- Counters live in Postgres rather than in the edge runtime because isolates
-- are short lived and per-instance, so an in-memory counter cannot enforce a
-- limit shared by all requests.
--
-- Two limits apply:
--   per ip     caps requests from one address inside a window.
--   daily cap  caps total requests per day across all addresses, so the limit
--              still applies when the source address changes.

create table if not exists public.chat_rate_limit (
  ip     text        not null,
  bucket timestamptz not null,
  hits   integer     not null default 0,
  primary key (ip, bucket)
);

create index if not exists chat_rate_limit_bucket_idx
  on public.chat_rate_limit (bucket);

-- RLS is enabled with no policies, so the table is reachable only through the
-- SECURITY DEFINER functions below.
alter table public.chat_rate_limit enable row level security;

create or replace function public.chat_take_token(
  p_ip             text,
  p_limit          integer default 12,
  p_window_seconds integer default 60,
  p_daily_cap      integer default 2000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket timestamptz;
  v_hits   integer;
  v_used   integer;
begin
  if p_ip is null or length(p_ip) = 0 then
    p_ip := 'unknown';
  end if;

  if p_limit < 1 or p_window_seconds < 1 or p_daily_cap < 1 then
    return jsonb_build_object('allowed', false, 'reason', 'bad-config');
  end if;

  -- Fixed window: every request in the same window maps to one row.
  v_bucket := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  -- Atomic increment; concurrent requests serialize on the primary key.
  insert into public.chat_rate_limit as t (ip, bucket, hits)
  values (p_ip, v_bucket, 1)
  on conflict (ip, bucket) do update set hits = t.hits + 1
  returning t.hits into v_hits;

  -- Total for the current day across all addresses.
  select coalesce(sum(hits), 0) into v_used
  from public.chat_rate_limit
  where bucket >= date_trunc('day', now());

  if v_hits > p_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'per-ip',
      'retry_after', p_window_seconds
    );
  end if;

  if v_used > p_daily_cap then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'daily-cap',
      'retry_after', 3600
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'remaining', greatest(p_limit - v_hits, 0)
  );
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default. Restrict both functions to the
-- service role, which the edge function already uses.
revoke all on function public.chat_take_token(text, integer, integer, integer) from public;
revoke all on function public.chat_take_token(text, integer, integer, integer) from anon;
revoke all on function public.chat_take_token(text, integer, integer, integer) from authenticated;
grant execute on function public.chat_take_token(text, integer, integer, integer) to service_role;

-- Removes rows older than two days. Called by pg_cron when configured,
-- otherwise by the edge function.
create or replace function public.chat_rate_limit_prune()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.chat_rate_limit where bucket < now() - interval '2 days';
$$;

revoke all on function public.chat_rate_limit_prune() from public;
revoke all on function public.chat_rate_limit_prune() from anon;
revoke all on function public.chat_rate_limit_prune() from authenticated;
grant execute on function public.chat_rate_limit_prune() to service_role;

-- Optional: schedule the prune when pg_cron is enabled.
-- select cron.schedule(
--   'prune-chat-rate-limit',
--   '17 * * * *',
--   $$select public.chat_rate_limit_prune()$$
-- );
