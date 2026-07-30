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
