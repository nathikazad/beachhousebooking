#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

purpose="${1:-manual-backup}"
purpose_slug="$(printf '%s' "$purpose" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
if [[ -z "$purpose_slug" ]]; then
  echo "Purpose must contain at least one letter or number." >&2
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
env_file="${BACKUP_ENV_FILE:-$repo_root/spa/.env.local}"
output_root="${BACKUP_OUTPUT_ROOT:-$repo_root/supabase/backups}"
supabase_version="${SUPABASE_VERSION:-2.110.0}"
validation_image="${VALIDATION_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.143}"
created_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
backup_dir="$output_root/$timestamp-$purpose_slug"
validation_container="bhb-backup-verify-$(printf '%s' "$timestamp" | tr '[:upper:]' '[:lower:]')"

if [[ ! -f "$env_file" ]]; then
  echo "Environment file not found: $env_file" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is missing from $env_file" >&2
  exit 1
fi

docker_bin="$(command -v docker || true)"
if [[ -z "$docker_bin" && -x /Applications/Docker.app/Contents/Resources/bin/docker ]]; then
  docker_bin=/Applications/Docker.app/Contents/Resources/bin/docker
fi
if [[ -z "$docker_bin" ]]; then
  echo "Docker is required for Supabase dumps and restore validation." >&2
  exit 1
fi
if ! "$docker_bin" info >/dev/null 2>&1; then
  echo "Docker Desktop is not running or is inaccessible." >&2
  exit 1
fi
export PATH="$(dirname "$docker_bin"):$PATH"

if command -v supabase >/dev/null 2>&1; then
  supabase_cmd=(supabase)
elif command -v npx >/dev/null 2>&1; then
  supabase_cmd=(npx --yes "supabase@$supabase_version")
elif [[ -n "${CODEX_NODE_BIN:-}" && -x "${CODEX_NODE_BIN:-}" && -n "${CODEX_PNPM_BIN:-}" && -x "${CODEX_PNPM_BIN:-}" ]]; then
  export PATH="$(dirname "$CODEX_NODE_BIN"):$(dirname "$docker_bin"):/usr/bin:/bin:/usr/sbin:/sbin"
  supabase_cmd=("$CODEX_PNPM_BIN" dlx "supabase@$supabase_version")
else
  echo "Supabase CLI unavailable. Install it, provide npx, or set CODEX_NODE_BIN and CODEX_PNPM_BIN." >&2
  exit 1
fi

container_started=0
cleanup() {
  if [[ "$container_started" -eq 1 ]]; then
    "$docker_bin" rm -f "$validation_container" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

mkdir -p "$output_root"
chmod 700 "$output_root"
mkdir -m 700 "$backup_dir"

echo "Backing up production database to $backup_dir"
"${supabase_cmd[@]}" db dump --db-url "$DATABASE_URL" --role-only --file "$backup_dir/roles.sql"
"${supabase_cmd[@]}" db dump --db-url "$DATABASE_URL" --file "$backup_dir/schema.sql"
"${supabase_cmd[@]}" db dump --db-url "$DATABASE_URL" --data-only --use-copy --schema auth,public,storage --file "$backup_dir/data.sql"
"${supabase_cmd[@]}" db dump --db-url "$DATABASE_URL" --data-only --use-copy --schema public --file "$backup_dir/public-data.sql"

for required_file in roles.sql schema.sql data.sql public-data.sql; do
  if [[ ! -s "$backup_dir/$required_file" ]]; then
    echo "Required dump is empty: $backup_dir/$required_file" >&2
    exit 1
  fi
done

count_copy_rows() {
  local table_name="$1"
  awk -v wanted="$table_name" '
    /^COPY "public"\./ {
      split($0, parts, "\"")
      active = (parts[4] == wanted)
      next
    }
    active && $0 == "\\." { print count + 0; exit }
    active { count++ }
  ' "$backup_dir/public-data.sql"
}

bookings_count="$(count_copy_rows bookings)"
cost_items_count="$(count_copy_rows booking_cost_items)"
occupancies_count="$(count_copy_rows booking_occupancies)"
payments_count="$(count_copy_rows booking_payments)"
deposits_count="$(count_copy_rows booking_security_deposits)"
auth_tables_count="$(awk '/^COPY "auth"\./ { count++ } END { print count + 0 }' "$backup_dir/data.sql")"
storage_tables_count="$(awk '/^COPY "storage"\./ { count++ } END { print count + 0 }' "$backup_dir/data.sql")"

gzip -c "$backup_dir/data.sql" > "$backup_dir/data.sql.gz"
gzip -c "$backup_dir/public-data.sql" > "$backup_dir/public-data.sql.gz"

echo "Restoring public backup into isolated validation database"
"$docker_bin" run -d --name "$validation_container" \
  -e POSTGRES_PASSWORD=backup-verify-only \
  -v "$backup_dir:/backup:ro" \
  "$validation_image" >/dev/null
container_started=1

ready=0
for validation_try in {1..45}; do
  if "$docker_bin" exec "$validation_container" pg_isready -U postgres >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" -ne 1 ]]; then
  echo "Temporary validation database did not become ready." >&2
  exit 1
fi

psql_cmd=("$docker_bin" exec -e PGPASSWORD=backup-verify-only "$validation_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1)
"${psql_cmd[@]}" -f /backup/roles.sql >/dev/null
"${psql_cmd[@]}" -f /backup/schema.sql >/dev/null
"${psql_cmd[@]}" -f /backup/public-data.sql >/dev/null

restored_counts="$("${psql_cmd[@]}" -Atc "SELECT count(*) FROM public.bookings; SELECT count(*) FROM public.booking_cost_items; SELECT count(*) FROM public.booking_occupancies; SELECT count(*) FROM public.booking_payments; SELECT count(*) FROM public.booking_security_deposits;")"
expected_counts="$(printf '%s\n%s\n%s\n%s\n%s' "$bookings_count" "$cost_items_count" "$occupancies_count" "$payments_count" "$deposits_count")"
if [[ "$restored_counts" != "$expected_counts" ]]; then
  echo "Restored row counts do not match exported row counts." >&2
  exit 1
fi

orphan_count="$("${psql_cmd[@]}" -Atc "SELECT (SELECT count(*) FROM public.booking_cost_items c LEFT JOIN public.bookings b ON b.id = c.booking_id WHERE b.id IS NULL) + (SELECT count(*) FROM public.booking_occupancies o LEFT JOIN public.bookings b ON b.id = o.booking_id WHERE b.id IS NULL) + (SELECT count(*) FROM public.booking_payments p LEFT JOIN public.bookings b ON b.id = p.booking_id WHERE b.id IS NULL) + (SELECT count(*) FROM public.booking_security_deposits d LEFT JOIN public.bookings b ON b.id = d.booking_id WHERE b.id IS NULL);")"
if [[ "$orphan_count" != "0" ]]; then
  echo "Restore contains $orphan_count orphaned booking child rows." >&2
  exit 1
fi

cat > "$backup_dir/manifest.txt" <<EOF
Beach House Booking production database backup

Created at: $created_at
Purpose: $purpose
Supabase CLI: $supabase_version

Contents:
- roles.sql: Database role settings.
- schema.sql: Application schema, functions, constraints, indexes, grants, and extensions.
- data.sql: Auth metadata, public application data, and Storage metadata.
- public-data.sql: Public application data only for standalone restoration and verification.
- data.sql.gz and public-data.sql.gz: Compressed copies of the data exports.
- checksums.txt: SHA-256 checksums for all other backup artifacts.

Export and restore verification:
- public.bookings rows: $bookings_count
- public.booking_cost_items rows: $cost_items_count
- public.booking_occupancies rows: $occupancies_count
- public.booking_payments rows: $payments_count
- public.booking_security_deposits rows: $deposits_count
- Auth tables exported: $auth_tables_count
- Storage metadata tables exported: $storage_tables_count
- Restored into isolated $validation_image with ON_ERROR_STOP enabled: successful
- Orphan booking child rows: 0

Coverage note:
- Storage object files are not included; only Storage database metadata is exported.

Security:
- These files contain production customer, authentication, and financial data.
- Keep this directory out of Git and do not share or upload it without encryption.
EOF

chmod 600 "$backup_dir"/*
(
  cd "$backup_dir"
  shasum -a 256 roles.sql schema.sql data.sql public-data.sql data.sql.gz public-data.sql.gz manifest.txt > checksums.txt
  chmod 600 checksums.txt
  shasum -a 256 -c checksums.txt
)

echo "Backup verified successfully"
echo "Path: $backup_dir"
echo "Bookings: $bookings_count"
echo "Cost items: $cost_items_count"
echo "Occupancies: $occupancies_count"
echo "Payments: $payments_count"
echo "Security deposits: $deposits_count"
echo "Storage object files: not included"
