#!/usr/bin/env bash
# Runs a minimal local Supabase-compatible stack WITHOUT Docker:
#   Postgres (must already be running) + GoTrue (Supabase Auth) + PostgREST + a tiny gateway.
# Intended for E2E tests in environments where `supabase start` is unavailable.
#
#   scripts/local-stack.sh up     # downloads binaries to .cache/, migrates, starts services, writes .env.e2e
#   scripts/local-stack.sh down
#
# Requires: psql, curl, node, and a superuser connection in PG_ADMIN_URL.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
CACHE="$ROOT/.cache/local-stack"
PG_ADMIN_URL="${PG_ADMIN_URL:-postgresql://postgres:postgres@127.0.0.1:5432/postgres}"
DB="${E2E_DB:-orbit_e2e}"
DB_URL="${PG_ADMIN_URL%/*}/$DB"
JWT_SECRET="${E2E_JWT_SECRET:-local-e2e-jwt-secret-at-least-32-characters}"
AUTH_VERSION=v2.180.0
PGRST_VERSION=v12.2.3
mkdir -p "$CACHE"

down() {
  for p in gateway auth postgrest; do
    [ -f "$CACHE/$p.pid" ] && kill "$(cat "$CACHE/$p.pid")" 2>/dev/null || true
    rm -f "$CACHE/$p.pid"
  done
}

if [ "${1:-up}" = "down" ]; then down; exit 0; fi
down

if [ ! -x "$CACHE/auth/auth" ]; then
  curl -fsSL "https://github.com/supabase/auth/releases/download/$AUTH_VERSION/auth-$AUTH_VERSION-x86.tar.gz" -o "$CACHE/auth.tgz"
  mkdir -p "$CACHE/auth" && tar -xzf "$CACHE/auth.tgz" -C "$CACHE/auth"
fi
if [ ! -x "$CACHE/postgrest" ]; then
  curl -fsSL "https://github.com/PostgREST/postgrest/releases/download/$PGRST_VERSION/postgrest-$PGRST_VERSION-linux-static-x64.tar.xz" -o "$CACHE/pgrst.tar.xz"
  tar -xJf "$CACHE/pgrst.tar.xz" -C "$CACHE"
fi

psql "$PG_ADMIN_URL" -q -c "drop database if exists $DB with (force)" -c "create database $DB"
psql "$DB_URL" -q -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit password 'authenticator'; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin login createrole password 'auth_admin'; end if;
end $$;
grant anon, authenticated, service_role to authenticator;
create schema if not exists auth authorization supabase_auth_admin;
grant usage on schema public to anon, authenticated, service_role;
SQL
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -c "grant create on database $DB to supabase_auth_admin"

export GOTRUE_DB_DRIVER=postgres
export DATABASE_URL="${PG_ADMIN_URL%%://*}://supabase_auth_admin:auth_admin@${PG_ADMIN_URL#*@}"
DATABASE_URL="${DATABASE_URL%/*}/$DB?search_path=auth"
export GOTRUE_API_HOST=127.0.0.1 PORT=9999 API_EXTERNAL_URL=http://127.0.0.1:54321/auth/v1
export GOTRUE_SITE_URL=http://localhost:3000 GOTRUE_URI_ALLOW_LIST="http://localhost:3000/**"
export GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role
export GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_DISABLE_SIGNUP=false GOTRUE_LOG_LEVEL=warn
export GOTRUE_DB_MIGRATIONS_PATH="$CACHE/auth/migrations"
"$CACHE/auth/auth" migrate >/dev/null
nohup "$CACHE/auth/auth" > "$CACHE/auth.log" 2>&1 < /dev/null &
echo $! > "$CACHE/auth.pid"

# GoTrue owns auth.*; the shim grants mirror Supabase defaults that the app migration relies on.
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -c "grant usage on schema auth to anon, authenticated, service_role, postgres; grant select on auth.users to postgres; grant execute on all functions in schema auth to anon, authenticated, service_role;"
for f in supabase/migrations/*.sql; do psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "$f"; done

PGRST_DB_URI="${PG_ADMIN_URL%%://*}://authenticator:authenticator@${PG_ADMIN_URL#*@}"
export PGRST_DB_URI="${PGRST_DB_URI%/*}/$DB"
export PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$JWT_SECRET" PGRST_SERVER_PORT=3001 PGRST_SERVER_HOST=127.0.0.1
nohup "$CACHE/postgrest" > "$CACHE/postgrest.log" 2>&1 < /dev/null &
echo $! > "$CACHE/postgrest.pid"
nohup node scripts/local-stack/gateway.mjs > "$CACHE/gateway.log" 2>&1 < /dev/null &
echo $! > "$CACHE/gateway.pid"

ANON=$(node scripts/local-stack/jwt.mjs "$JWT_SECRET" anon)
SERVICE=$(node scripts/local-stack/jwt.mjs "$JWT_SECRET" service_role)
cat > .env.e2e <<ENV
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SERVICE
NEXT_PUBLIC_APP_URL=http://localhost:3000
ORBIT_ENCRYPTION_KEY=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))")
CRON_SECRET=local-e2e-cron-secret-0123456789
E2E_DB_URL=$DB_URL
ENV
for i in $(seq 1 30); do
  curl -fsS http://127.0.0.1:54321/auth/v1/health >/dev/null 2>&1 && curl -fsS -H "apikey: $ANON" -H "Authorization: Bearer $ANON" http://127.0.0.1:54321/rest/v1/ >/dev/null 2>&1 && { echo "local stack ready (.env.e2e written)"; exit 0; }
  sleep 1
done
echo "stack failed to start; see $CACHE/*.log" >&2
exit 1
