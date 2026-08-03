---
name: backup-production-database
description: Create and validate a local backup of the Beach House Booking production Supabase database. Use before destructive database work, data cleanup, schema migrations, bulk updates, or whenever the user asks to dump, snapshot, back up, restore-test, or verify production booking data.
---

# Backup Production Database

Create a private, timestamped production snapshot under `supabase/backups/` and prove that its booking data restores successfully before reporting completion.

## Workflow

1. Work from the repository root.
2. Confirm `spa/.env.local` exists and contains `DATABASE_URL`; never print or log its value.
3. Run `scripts/backup_production_database.sh`. Pass a short purpose as the first argument when useful, for example:

   ```bash
   skills/backup-production-database/scripts/backup_production_database.sh pre-booking-cleanup
   ```

4. If neither `supabase` nor `npx` is available, load the Codex bundled workspace dependencies and set `CODEX_NODE_BIN` and `CODEX_PNPM_BIN` for the script:

   ```bash
   CODEX_NODE_BIN=/absolute/path/to/node \
   CODEX_PNPM_BIN=/absolute/path/to/pnpm \
   skills/backup-production-database/scripts/backup_production_database.sh pre-booking-cleanup
   ```

5. Approve production network access and Docker access when the environment requires it. The database operations are read-only.
6. Do not run the planned destructive operation unless the script finishes with `Backup verified successfully`.
7. Report the backup path, table counts, restore-test result, and the fact that Storage object files are excluded.

## Guarantees and guardrails

- Export roles, schema, Auth metadata, public application data, and Storage metadata.
- Export a second public-only data file for standalone restoration checks.
- Include uncompressed and compressed data, a manifest, and SHA-256 checksums.
- Restore roles, schema, and public data into an isolated temporary Supabase Postgres container.
- Verify booking-related row counts and confirm there are no orphaned cost items, occupancies, payments, or security deposits.
- Remove only the temporary validation container; retain a failed backup directory for diagnosis.
- Use restrictive directory and file permissions and rely on the repository's `supabase/backups/` Git ignore rule.
- Never commit, upload, quote, or expose backup contents or database credentials.
- Treat the backup as containing production customer, authentication, and financial data.
- Note that Storage database metadata is included but Storage object files are not.

## Script

Use `scripts/backup_production_database.sh` for the complete workflow. Optional environment overrides are `BACKUP_ENV_FILE`, `BACKUP_OUTPUT_ROOT`, `SUPABASE_VERSION`, `VALIDATION_IMAGE`, `CODEX_NODE_BIN`, and `CODEX_PNPM_BIN`.
