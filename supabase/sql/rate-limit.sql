-- rate limiting for kambarage (supabase/functions/ramani-chat)
--
-- run this once in the supabase sql editor, then deploy the function.
-- it is safe to run more than once.
--
-- why postgres and not memory: edge isolates are short lived and there are
-- many of them, so an in-memory counter is both forgetful and per-instance.
-- a shared table gives one true counter across every isolate.
--
-- two layers, because they defend different things:
--   per ip   -> stops one person hammering the endpoint.
--   daily cap -> stops a botnet rotating ips. this is the one that protects
--                your wallet, because it cannot be evaded by changing address.

create table if not exists public.chat_rate_limit (
  ip     text        not null,
  bucket timestamptz not null,
  hits   integer     not null default 0,
  primary key (ip, bucket)
);

create index if not exists chat_rate_limit_bucket_idx
  on public.chat_rate_limit (bucket);

-- no policies on purpose. only the security definer function below touches it,
-- and the anon key can neither read nor write it.
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

  -- fixed window: every request in the same window shares one row
  v_bucket := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  -- atomic increment. concurrent requests serialise on the primary key.
  insert into public.chat_rate_limit as t (ip, bucket, hits)
  values (p_ip, v_bucket, 1)
  on conflict (ip, bucket) do update set hits = t.hits + 1
  returning t.hits into v_hits;

  -- total for today, across every ip
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

-- execute is granted to public by default in postgres. take it back so only
-- the service role, which the edge function already holds, can call it.
revoke all on function public.chat_take_token(text, integer, integer, integer) from public;
revoke all on function public.chat_take_token(text, integer, integer, integer) from anon;
revoke all on function public.chat_take_token(text, integer, integer, integer) from authenticated;
grant execute on function public.chat_take_token(text, integer, integer, integer) to service_role;

-- housekeeping: drop rows older than two days. call it from cron, or let the
-- edge function's occasional prune handle it.
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

-- optional: schedule the prune if pg_cron is enabled on the project.
-- select cron.schedule(
--   'prune-chat-rate-limit',
--   '17 * * * *',
--   $$select public.chat_rate_limit_prune()$$
-- );
