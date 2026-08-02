-- Browser reads are authenticated and read-only. All booking mutations continue
-- through the server-side API and its direct Postgres connection.

alter table public.bookings enable row level security;

revoke all on table public.bookings from anon, authenticated;
revoke all on sequence public.notes_id_seq from anon, authenticated;
grant select on table public.bookings to authenticated;

drop policy if exists "authenticated staff can read bookings"
  on public.bookings;
create policy "authenticated staff can read bookings"
  on public.bookings
  for select
  to authenticated
  using (true);

revoke all on table public.booking_cost_items from anon, authenticated;
revoke all on table public.booking_payments from anon, authenticated;
revoke all on table public.booking_security_deposits from anon, authenticated;

grant select on table public.booking_cost_items to authenticated;
grant select on table public.booking_payments to authenticated;
grant select on table public.booking_security_deposits to authenticated;

drop policy if exists "authenticated staff can read booking costs"
  on public.booking_cost_items;
create policy "authenticated staff can read booking costs"
  on public.booking_cost_items
  for select
  to authenticated
  using (true);

drop policy if exists "authenticated staff can read booking payments"
  on public.booking_payments;
create policy "authenticated staff can read booking payments"
  on public.booking_payments
  for select
  to authenticated
  using (true);

drop policy if exists "authenticated staff can read booking deposits"
  on public.booking_security_deposits;
create policy "authenticated staff can read booking deposits"
  on public.booking_security_deposits
  for select
  to authenticated
  using (true);

create or replace view public.booking_current_details
with (security_invoker = true)
as
select
  booking.id,
  case
    when coalesce(array_length(booking.json, 1), 0) = 0 then '[]'::jsonb
    else jsonb_build_array(booking.json[array_upper(booking.json, 1)])
  end as history,
  coalesce(array_length(booking.json, 1), 0) as history_count,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', cost.id,
          'property', cost.property,
          'event_id', cost.event_id,
          'item_type', cost.item_type,
          'name', cost.name,
          'amount', cost.amount
        )
        order by cost.id
      )
      from public.booking_cost_items cost
      where cost.booking_id = booking.id
    ),
    '[]'::jsonb
  ) as cost_items,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', payment.id,
          'amount', payment.amount,
          'payment_method', payment.payment_method,
          'payment_date', payment.payment_date,
          'received_by', payment.received_by,
          'details', payment.details
        )
        order by payment.payment_date, payment.id
      )
      from public.booking_payments payment
      where payment.booking_id = booking.id
    ),
    '[]'::jsonb
  ) as payments,
  (
    select jsonb_build_object(
      'amount', deposit.amount,
      'payment_method', deposit.payment_method,
      'amount_returned', deposit.amount_returned,
      'date_returned', deposit.date_returned
    )
    from public.booking_security_deposits deposit
    where deposit.booking_id = booking.id
  ) as security_deposit
from public.bookings booking;

revoke all on table public.booking_current_details from public, anon, authenticated;
grant select on table public.booking_current_details to authenticated, service_role;

create or replace view public.booking_history_details
with (security_invoker = true)
as
select
  booking.id,
  coalesce(to_jsonb(booking.json), '[]'::jsonb) as history,
  current.history_count,
  current.cost_items,
  current.payments,
  current.security_deposit
from public.bookings booking
join public.booking_current_details current on current.id = booking.id;

revoke all on table public.booking_history_details from public, anon, authenticated;
grant select on table public.booking_history_details to authenticated, service_role;

-- This legacy table is unused and must not be available through PostgREST.
alter table public.cmd_exec enable row level security;
revoke all on table public.cmd_exec from public, anon, authenticated;

-- Reports are used by signed-in staff. Anonymous callers do not need access.
alter function public.get_booking_stats(integer, integer, text, text)
  set search_path = public, pg_temp;
alter function public.get_checkin_stats(integer, integer, text, text)
  set search_path = public, pg_temp;

revoke all on function public.get_booking_stats(integer, integer, text, text)
  from public, anon;
revoke all on function public.get_checkin_stats(integer, integer, text, text)
  from public, anon;
grant execute on function public.get_booking_stats(integer, integer, text, text)
  to authenticated, service_role;
grant execute on function public.get_checkin_stats(integer, integer, text, text)
  to authenticated, service_role;

-- New public-schema objects should be private until a migration grants the
-- exact browser access they require.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
