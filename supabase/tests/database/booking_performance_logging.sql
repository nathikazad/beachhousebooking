begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

select has_function(
  'public',
  'log_booking_read_performance',
  array['bigint', 'uuid', 'text', 'numeric', 'numeric', 'numeric', 'integer', 'boolean', 'text'],
  'booking performance log function exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.log_booking_read_performance(bigint,uuid,text,numeric,numeric,numeric,integer,boolean,text)',
    'EXECUTE'
  ),
  'anonymous callers cannot write performance logs'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.log_booking_read_performance(bigint,uuid,text,numeric,numeric,numeric,integer,boolean,text)',
    'EXECUTE'
  ),
  'authenticated staff can write performance logs'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"123e4567-e89b-12d3-a456-426614174000","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.log_booking_read_performance(
    3126,
    '123e4567-e89b-12d3-a456-426614174000',
    'network',
    524.64,
    511.27,
    1.36,
    1489,
    true,
    null
  )$$,
  'P0001',
  null,
  'valid metrics produce the tagged runtime-log exception'
);

select throws_ok(
  $$select public.log_booking_read_performance(
    3126,
    '123e4567-e89b-12d3-a456-426614174000',
    'invalid-cache',
    1,
    1,
    1,
    1,
    true,
    null
  )$$,
  '22023',
  'Invalid booking performance metric',
  'invalid metrics are rejected before logging'
);

select * from finish();
rollback;
