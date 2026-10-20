#!/usr/bin/env bash
# Applies the migrations to a throwaway local Postgres database and runs the
# RLS / constraint tests against it. Requires a local Postgres server and
# DATABASE_TEST_URL pointing to a superuser connection (default below).
set -euo pipefail
cd "$(dirname "$0")/.."
export DATABASE_TEST_URL="${DATABASE_TEST_URL:-postgresql://postgres:postgres@127.0.0.1:5432/postgres}"
DB="orbit_test_$$"
psql "$DATABASE_TEST_URL" -q -c "create database $DB"
trap 'psql "$DATABASE_TEST_URL" -q -c "drop database if exists $DB with (force)"' EXIT
TEST_URL="${DATABASE_TEST_URL%/*}/$DB"
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_shim.sql
for f in supabase/migrations/*.sql; do psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$f"; done
ORBIT_DB_URL="$TEST_URL" npx vitest run --config vitest.db.config.ts
