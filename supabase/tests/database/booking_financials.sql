begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

select has_table(
  'public',
  'booking_cost_items',
  'booking cost items table exists'
);

select has_table(
  'public',
  'booking_payments',
  'booking payments table exists'
);

select has_table(
  'public',
  'booking_security_deposits',
  'booking security deposits table exists'
);

select col_is_null(
  'public',
  'booking_cost_items',
  'property',
  'property remains nullable for ambiguous legacy items'
);

insert into public.bookings (
  id,
  client_name,
  client_phone_number,
  status,
  properties,
  check_in,
  check_out
)
values (
  9101,
  'Financial test',
  '100',
  'confirmed',
  array['castle'::public.property],
  '2026-08-01 10:00:00',
  '2026-08-01 12:00:00'
);

insert into public.booking_cost_items (
  booking_id,
  property,
  item_type,
  name,
  amount
)
values
  (9101, 'castle', 'cost', 'Rent', 1000),
  (9101, null, 'cost', 'Ambiguous legacy item', 50),
  (9101, 'castle', 'tax', 'Tax', 180);

insert into public.booking_payments (
  booking_id,
  amount,
  payment_method,
  payment_date,
  details
)
values (
  9101,
  500,
  'Bank transfert',
  '2026-07-01T10:00:00Z',
  '{"bankAccount":"HDFC Current"}'::jsonb
);

insert into public.booking_security_deposits (
  booking_id,
  amount,
  payment_method,
  amount_returned
)
values (9101, 1000, 'Cash', 0);

select is(
  (select total_cost from public.booking_financial_totals where booking_id = 9101),
  1050::numeric,
  'totals view sums cost items'
);

select is(
  (select tax from public.booking_financial_totals where booking_id = 9101),
  180::numeric,
  'totals view keeps tax as its own item type'
);

select is(
  (select paid from public.booking_financial_totals where booking_id = 9101),
  500::numeric,
  'totals view sums booking payments'
);

select is(
  (select outstanding from public.booking_financial_totals where booking_id = 9101),
  730::numeric,
  'outstanding includes costs and tax minus payments'
);

select is(
  (
    select details ->> 'bankAccount'
    from public.booking_payments
    where booking_id = 9101
  ),
  'HDFC Current',
  'payment details preserve unstructured information'
);

select throws_ok(
  $$
    insert into public.booking_cost_items (
      booking_id,
      property,
      item_type,
      name,
      amount
    )
    values (9101, 'castle', 'cost', 'Invalid', -1)
  $$,
  '23514',
  null,
  'negative cost amounts are rejected'
);

delete from public.bookings where id = 9101;

select is(
  (select count(*) from public.booking_cost_items where booking_id = 9101),
  0::bigint,
  'deleting a booking cascades to cost and tax items'
);

select is(
  (select count(*) from public.booking_payments where booking_id = 9101),
  0::bigint,
  'deleting a booking cascades to payments'
);

select is(
  (
    select count(*)
    from public.booking_security_deposits
    where booking_id = 9101
  ),
  0::bigint,
  'deleting a booking cascades to security deposits'
);

select * from finish();

rollback;
