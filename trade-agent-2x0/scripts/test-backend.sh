#!/usr/bin/env bash
# Roda os testes do backend. Para os testes de banco, defina TEST_DATABASE_URL (banco vazio dedicado).
set -euo pipefail
cd "$(dirname "$0")/../backend"
python3 -m pytest -q
