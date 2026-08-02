begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

select has_view(
  'public',
  'booking_current_details',
  'current booking read view exists'
);

select has_view(
  'public',
  'booking_history_details',
  'booking history read view exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.bookings'::regclass),
  'bookings has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.cmd_exec'::regclass),
  'legacy cmd_exec table has RLS enabled'
);

select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'bookings'),
  1::bigint,
  'bookings has one explicit read policy'
);

select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'booking_cost_items'),
  1::bigint,
  'booking costs have one explicit read policy'
);

select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'booking_payments'),
  1::bigint,
  'booking payments have one explicit read policy'
);

select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'booking_security_deposits'),
  1::bigint,
  'booking deposits have one explicit read policy'
);

select ok(
  has_table_privilege('authenticated', 'public.bookings', 'SELECT'),
  'authenticated staff can select bookings'
);

select ok(
  not has_table_privilege('authenticated', 'public.bookings', 'INSERT'),
  'authenticated browser clients cannot insert bookings'
);

select ok(
  not has_table_privilege('anon', 'public.bookings', 'SELECT'),
  'anonymous clients cannot select bookings'
);

select ok(
  has_table_privilege('authenticated', 'public.booking_cost_items', 'SELECT'),
  'authenticated staff can select booking costs'
);

select ok(
  not has_table_privilege('authenticated', 'public.booking_cost_items', 'INSERT'),
  'authenticated browser clients cannot insert booking costs'
);

select ok(
  has_table_privilege('authenticated', 'public.booking_payments', 'SELECT'),
  'authenticated staff can select booking payments'
);

select ok(
  has_table_privilege('authenticated', 'public.booking_security_deposits', 'SELECT'),
  'authenticated staff can select booking deposits'
);

select ok(
  has_table_privilege('authenticated', 'public.booking_current_details', 'SELECT'),
  'authenticated staff can select the current booking view'
);

select ok(
  not has_table_privilege('anon', 'public.booking_current_details', 'SELECT'),
  'anonymous clients cannot select the current booking view'
);

select ok(
  has_table_privilege('authenticated', 'public.booking_history_details', 'SELECT'),
  'authenticated staff can select the booking history view'
);

select ok(
  not has_table_privilege('anon', 'public.booking_history_details', 'SELECT'),
  'anonymous clients cannot select the booking history view'
);

select ok(
  not has_table_privilege('authenticated', 'public.cmd_exec', 'SELECT'),
  'authenticated clients cannot read cmd_exec'
);

select ok(
  not has_table_privilege('anon', 'public.cmd_exec', 'SELECT'),
  'anonymous clients cannot read cmd_exec'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_booking_stats(integer,integer,text,text)',
    'EXECUTE'
  ),
  'authenticated staff can run booking reports'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_booking_stats(integer,integer,text,text)',
    'EXECUTE'
  ),
  'anonymous clients cannot run booking reports'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_checkin_stats(integer,integer,text,text)',
    'EXECUTE'
  ),
  'authenticated staff can run check-in reports'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_checkin_stats(integer,integer,text,text)',
    'EXECUTE'
  ),
  'anonymous clients cannot run check-in reports'
);

insert into public.bookings (
  id,
  json,
  client_name,
  client_phone_number,
  status,
  properties,
  check_in,
  check_out
)
values (
  9202,
  array['{"encodingVersion":2,"client":{"name":"RLS test"}}'::jsonb],
  'RLS test',
  '100',
  'confirmed',
  array['castle'::public.property],
  '2026-08-01 10:00:00',
  '2026-08-01 12:00:00'
);

set local role authenticated;

select is(
  (select history_count from public.booking_current_details where id = 9202),
  1,
  'authenticated staff can read a current booking through the invoker view'
);

select is(
  jsonb_array_length(
    (select history from public.booking_history_details where id = 9202)
  ),
  1,
  'authenticated staff can read full history through the invoker view'
);

select throws_ok(
  $$
    insert into public.bookings (
      client_name,
      client_phone_number,
      check_in
    ) values ('Blocked browser write', '100', now())
  $$,
  '42501',
  null,
  'authenticated browser writes remain blocked'
);

reset role;

select * from finish();

rollback;
