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
