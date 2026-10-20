#!/usr/bin/env bash
# Sobe um Postgres 16 temporário, aplica stub do Supabase + migrations e roda os testes de RLS.
# Uso: bash supabase/tests/run_local.sh   (requer postgresql-16 instalado)
set -euo pipefail
cd "$(dirname "$0")/../.."
BIN=${PG_BIN:-/usr/lib/postgresql/16/bin}
DIR=$(mktemp -d)
PORT=${PG_TEST_PORT:-55432}
if [ "$(id -u)" = "0" ]; then RUNAS="su postgres -s /bin/bash -c"; chown postgres "$DIR"; else RUNAS="bash -c"; fi
trap '$RUNAS "$BIN/pg_ctl -D $DIR stop -m fast" >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
$RUNAS "$BIN/initdb -D $DIR -U postgres -A trust >/dev/null"
$RUNAS "$BIN/pg_ctl -D $DIR -o '-p $PORT -k /tmp' -l $DIR/log start >/dev/null"
until "$BIN/pg_isready" -h /tmp -p "$PORT" >/dev/null 2>&1; do sleep 0.2; done
PSQL=("$BIN/psql" -h /tmp -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f supabase/tests/10_access_and_rls.sql 2>&1 | grep -E "ok —|FALHOU|ERROR|PASSARAM" | sed "s/.*NOTICE:  //"
exit "${PIPESTATUS[0]}"
