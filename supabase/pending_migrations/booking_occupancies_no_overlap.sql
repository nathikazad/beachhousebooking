-- Move this file into supabase/migrations with a new timestamp only after:
--   1. production occupancies have been backfilled,
--   2. the full conflict audit has been reviewed, and
--   3. all existing blocking conflicts have been resolved.
--
-- PostgreSQL exclusion constraints cannot be added as NOT VALID. Applying this
-- before reconciliation will fail when existing overlaps are present.

alter table public.booking_occupancies
  add constraint booking_occupancies_no_blocking_overlap
  exclude using gist (
    property with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('confirmed', 'preconfirmed'));
