#!/usr/bin/env bash
# Testa a migration + RLS + leitura pública num Postgres LOCAL descartável.
# Uso: TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db
# Cria e apaga um banco temporário. Nunca aponte para o Supabase de produção.
set -euo pipefail
: "${TEST_DATABASE_URL:?defina TEST_DATABASE_URL apontando para um Postgres local}"
DB="menu_builder_test_$$"
cd "$(dirname "$0")/../supabase"
psql "$TEST_DATABASE_URL" -qc "create database $DB;"
trap 'psql "$TEST_DATABASE_URL" -qc "drop database if exists $DB;"' EXIT
BASE="${TEST_DATABASE_URL%%\?*}"
QUERY="${TEST_DATABASE_URL#"$BASE"}"
URL="${BASE%/*}/$DB$QUERY"
psql "$URL" -v ON_ERROR_STOP=1 -q -f tests/supabase_stubs.sql
psql "$URL" -v ON_ERROR_STOP=1 -q -f migrations/20261012000000_menu_builder.sql
psql "$URL" -v ON_ERROR_STOP=1 -q -f tests/rls_test.sql
