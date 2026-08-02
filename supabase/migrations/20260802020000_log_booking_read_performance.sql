-- Store browser-perspective booking read measurements in the Supabase runtime
-- logs without persisting a second copy in an application table.
create or replace function public.log_booking_read_performance(
  p_booking_id bigint,
  p_browser_session_id uuid,
  p_cache_source text,
  p_total_ms numeric,
  p_supabase_ms numeric,
  p_hydrate_ms numeric,
  p_payload_bytes integer,
  p_success boolean,
  p_error_code text default null
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  metric jsonb;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  if p_booking_id <= 0
    or p_cache_source not in ('history-cache', 'latest-cache', 'inflight', 'network')
    or p_total_ms < 0 or p_total_ms > 120000
    or p_supabase_ms < 0 or p_supabase_ms > 120000
    or p_hydrate_ms < 0 or p_hydrate_ms > 120000
    or p_payload_bytes < 0 or p_payload_bytes > 10000000
    or length(coalesce(p_error_code, '')) > 100
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid booking performance metric';
  end if;

  metric := jsonb_build_object(
    'event', 'booking_read_performance',
    'bookingId', p_booking_id,
    'userId', auth.uid(),
    'browserSessionId', p_browser_session_id,
    'cacheSource', p_cache_source,
    'totalMs', round(p_total_ms, 1),
    'supabaseMs', round(p_supabase_ms, 1),
    'hydrateMs', round(p_hydrate_ms, 1),
    'payloadBytes', p_payload_bytes,
    'success', p_success,
    'errorCode', nullif(p_error_code, '')
  );

  -- Supabase retains raised exceptions in Postgres logs. The client treats this
  -- tagged exception as a fire-and-forget telemetry acknowledgement.
  raise exception using
    errcode = 'P0001',
    message = '[booking_read_performance] ' || metric::text;
end;
$$;

revoke all on function public.log_booking_read_performance(
  bigint, uuid, text, numeric, numeric, numeric, integer, boolean, text
) from public, anon;
grant execute on function public.log_booking_read_performance(
  bigint, uuid, text, numeric, numeric, numeric, integer, boolean, text
) to authenticated, service_role;
