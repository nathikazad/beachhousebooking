# Booking conflict audit

Run the pre-migration audit from `spa`:

```sh
npm run db:audit-pre-migration
```

The generated JSON report is written to
`supabase/audits/output/booking-conflicts.json`. The output directory is
ignored because the report contains customer information.

## Production snapshot — 2026-07-30

- 188 conflicting property/event periods
- 164 distinct conflicting booking pairs
- 17 upcoming conflicting property/event periods
- 2 malformed blocking legacy bookings that cannot be backfilled automatically:
  booking `256` and booking `379`

The audit includes Confirmed and Preconfirmed reservations and uses individual
Event periods rather than only the booking-level check-in/check-out envelope.
Back-to-back periods, where one booking starts exactly when another ends, are
not considered conflicts.

These figures are a point-in-time snapshot. Regenerate the report immediately
before production reconciliation and before enabling the exclusion constraint.
