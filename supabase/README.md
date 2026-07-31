# Local Supabase project

This directory contains the version-controlled baseline for the hosted
Supabase project.

## Captured locally

- Public database schema
- Public enums and tables
- PostgreSQL RPC functions
- Grants and default privileges
- Storage bucket declarations
- Local Supabase service configuration

The initial remote schema snapshot is stored in
`migrations/20260730000000_remote_schema.sql`.

## Intentionally excluded

- Production table rows
- Auth users and identities
- Storage objects
- Database passwords, API keys, JWT secrets, and provider credentials

Supabase-managed schemas such as `auth`, `storage`, `realtime`, and `vault`
are provided by the local Supabase runtime. Only project-owned objects and
configuration should be maintained here.

The hosted project currently has no deployed Edge Functions.

## Booking occupancy rollout

The `20260730010000_booking_occupancies.sql` migration creates normalized
property occupancy storage plus the conflict and audit functions. It
intentionally does not add the final no-overlap exclusion constraint yet.
Only Confirmed and Preconfirmed bookings create occupancy rows; incomplete
Inquiry and Quotation records do not block inventory.

Safe production rollout:

1. Apply the occupancy migration.
2. Run `npm run db:backfill-occupancies` from `spa` as a dry run.
3. Reconcile every malformed Confirmed or Preconfirmed legacy booking.
4. Run `npm run db:backfill-occupancies -- --apply`.
5. Run `npm run db:audit-conflicts`.
6. Resolve or explicitly approve existing conflicts.
7. Move `pending_migrations/booking_occupancies_no_overlap.sql` into
   `migrations` with a new timestamp and apply it.
8. Deploy the application validation change.

Before the occupancy table exists remotely, use
`npm run db:audit-pre-migration` to generate a read-only audit from the
latest booking JSON. Generated reports are ignored because they contain
customer information.

## Booking financial rollout

The `20260730122310_create_booking_financial_tables.sql` migration creates
normalized cost/tax items, payments, security deposits, and a derived totals
view.

Safe rollout:

1. Run all application and migration unit tests.
2. Apply `migrations/20260730122310_create_booking_financial_tables.sql`.
3. Deploy the compatibility application. It reads normalized rows when
   present and otherwise reads version-1 legacy financial JSON.
4. Run `npm run db:backfill-financials` from `spa` as a dry run.
5. Review every reported malformed value.
6. Run `npm run db:backfill-financials -- --apply`. The command refuses to
   apply when issues exist unless `--skip-malformed` is explicitly supplied.
7. Run `npm run db:backfill-financials -- --verify` to reconcile database row
   counts and monetary totals against the latest legacy JSON.

The backfill uses only the latest booking JSON snapshot. Costs and tax receive
the booking property only when the booking has exactly one property; zero- and
multi-property legacy bookings remain unassigned. Every new application cost
or tax requires a property.

New application snapshots use encoding version 2 and contain no costs, tax,
payments, deposits, or financial totals. Older JSON history remains unchanged.
The backfill locks and rechecks each booking before replacement and skips
version-2 bookings, so it cannot overwrite financial rows written by the new
application while migration is running.

## Background Google Calendar synchronization

Booking create, update, and delete requests commit Supabase first and release
their database connection. Vercel `waitUntil()` then synchronizes Google
Calendar from the captured before/after booking snapshots without delaying the
HTTP response.

Calendar-visible changes use deterministic IDs for new Google events, direct
patches for existing events, and bounded concurrency across properties. A
Calendar failure is logged in Vercel but is not retried automatically; Supabase
remains the authoritative booking database.

For serverless database connection reuse, prefer a Supabase transaction-pooler
connection string in `DATABASE_POOLER_URL`. `DATABASE_URL` remains the
fallback.
