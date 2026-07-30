begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

insert into public.bookings (
  id,
  client_name,
  client_phone_number,
  status,
  properties,
  check_in,
  check_out
)
values
  (
    9001,
    'Existing guest',
    '100',
    'confirmed',
    array['castle'::public.property],
    '2026-08-01 10:00:00',
    '2026-08-01 12:00:00'
  ),
  (
    9002,
    'Second guest',
    '200',
    'preconfirmed',
    array['castle'::public.property],
    '2026-08-01 11:00:00',
    '2026-08-01 13:00:00'
  );

insert into public.booking_occupancies (
  booking_id,
  event_key,
  event_name,
  property,
  starts_at,
  ends_at,
  status
)
values
  (
    9001,
    'stay',
    'Stay',
    'castle',
    '2026-08-01T10:00:00Z',
    '2026-08-01T12:00:00Z',
    'confirmed'
  ),
  (
    9002,
    'stay',
    'Stay',
    'castle',
    '2026-08-01T11:00:00Z',
    '2026-08-01T13:00:00Z',
    'preconfirmed'
  );

select is(
  (
    select count(*)
    from public.find_booking_conflicts(
      '[{"eventKey":"stay","eventName":"Stay","property":"castle","startsAt":"2026-08-01T11:30:00Z","endsAt":"2026-08-01T12:30:00Z","status":"confirmed"}]'::jsonb,
      null
    )
  ),
  2::bigint,
  'returns every overlapping confirmed and preconfirmed booking'
);

select is(
  (
    select count(*)
    from public.find_booking_conflicts(
      '[{"eventKey":"stay","eventName":"Stay","property":"castle","startsAt":"2026-08-01T11:30:00Z","endsAt":"2026-08-01T12:30:00Z","status":"confirmed"}]'::jsonb,
      9001
    )
  ),
  1::bigint,
  'excludes the booking being updated'
);

select is(
  (
    select count(*)
    from public.find_booking_conflicts(
      '[{"eventKey":"stay","eventName":"Stay","property":"castle","startsAt":"2026-08-01T13:00:00Z","endsAt":"2026-08-01T14:00:00Z","status":"confirmed"}]'::jsonb,
      null
    )
  ),
  0::bigint,
  'allows back-to-back periods'
);

select is(
  (
    select count(*)
    from public.find_booking_conflicts(
      '[{"eventKey":"stay","eventName":"Stay","property":"lechalet","startsAt":"2026-08-01T11:00:00Z","endsAt":"2026-08-01T12:00:00Z","status":"confirmed"}]'::jsonb,
      null
    )
  ),
  0::bigint,
  'does not conflict across properties'
);

select is(
  (
    select count(*)
    from public.audit_booking_conflicts(
      true,
      '2026-07-01T00:00:00Z'
    )
    where first_booking_id = 9001
      and second_booking_id = 9002
      and property = 'castle'
  ),
  1::bigint,
  'audit returns each conflicting booking pair once per occupancy pair'
);

select * from finish();

rollback;
