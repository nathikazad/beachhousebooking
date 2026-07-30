with latest as (
  select
    booking.id as booking_id,
    booking.client_name,
    booking.status,
    booking.properties,
    booking.check_in,
    booking.check_out,
    booking.json[array_upper(booking.json, 1)] as booking
  from public.bookings booking
  where booking.status in ('confirmed'::public.status, 'preconfirmed'::public.status)
),
stay_slots as (
  select
    latest.booking_id,
    latest.client_name,
    latest.status,
    'stay'::text as event_key,
    'Stay'::text as event_name,
    property,
    latest.check_in at time zone 'UTC' as starts_at,
    latest.check_out at time zone 'UTC' as ends_at
  from latest
  cross join lateral unnest(latest.properties) as property
  where latest.booking ->> 'bookingType' = 'Stay'
    and latest.check_in is not null
    and latest.check_out is not null
    and latest.check_in < latest.check_out
),
event_slots_raw as (
  select
    latest.booking_id,
    latest.client_name,
    latest.status,
    event,
    event_ordinality
  from latest
  cross join lateral jsonb_array_elements(
    coalesce(latest.booking -> 'events', '[]'::jsonb)
  ) with ordinality as events(event, event_ordinality)
  where latest.booking ->> 'bookingType' = 'Event'
    and not coalesce((event ->> 'markForDeletion')::boolean, false)
    and nullif(event ->> 'startDateTime', '') is not null
    and nullif(event ->> 'endDateTime', '') is not null
),
event_slots as (
  select
    raw.booking_id,
    raw.client_name,
    raw.status,
    case
      when nullif(raw.event ->> 'eventId', '') is not null
        then 'event-' || (raw.event ->> 'eventId')
      else 'event-index-' || (raw.event_ordinality - 1)::text
    end as event_key,
    coalesce(
      nullif(btrim(raw.event ->> 'eventName'), ''),
      'Event ' || raw.event_ordinality::text
    ) as event_name,
    lower(replace(property_name, ' ', ''))::public.property as property,
    (raw.event ->> 'startDateTime')::timestamptz as starts_at,
    (raw.event ->> 'endDateTime')::timestamptz as ends_at
  from event_slots_raw raw
  cross join lateral jsonb_array_elements_text(
    coalesce(raw.event -> 'properties', '[]'::jsonb)
  ) as property_name
  where (raw.event ->> 'startDateTime')::timestamptz
      < (raw.event ->> 'endDateTime')::timestamptz
),
slots as (
  select * from stay_slots
  union all
  select * from event_slots
)
select
  first_slot.booking_id as first_booking_id,
  first_slot.client_name as first_client_name,
  first_slot.status as first_status,
  first_slot.event_key as first_event_key,
  first_slot.event_name as first_event_name,
  first_slot.starts_at as first_starts_at,
  first_slot.ends_at as first_ends_at,
  second_slot.booking_id as second_booking_id,
  second_slot.client_name as second_client_name,
  second_slot.status as second_status,
  second_slot.event_key as second_event_key,
  second_slot.event_name as second_event_name,
  second_slot.starts_at as second_starts_at,
  second_slot.ends_at as second_ends_at,
  first_slot.property,
  greatest(first_slot.starts_at, second_slot.starts_at) as overlap_starts_at,
  least(first_slot.ends_at, second_slot.ends_at) as overlap_ends_at,
  least(first_slot.ends_at, second_slot.ends_at) < now() as historical
from slots first_slot
join slots second_slot
  on first_slot.booking_id < second_slot.booking_id
 and first_slot.property = second_slot.property
 and first_slot.starts_at < second_slot.ends_at
 and second_slot.starts_at < first_slot.ends_at
order by
  greatest(first_slot.starts_at, second_slot.starts_at),
  first_slot.property,
  first_slot.booking_id,
  second_slot.booking_id;
