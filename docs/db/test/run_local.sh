#!/usr/bin/env bash
# 로컬 PostgreSQL 16 으로 스키마 초안 + RLS 테스트 실행 (Supabase 계정 필요 없음)
# 사용: PGHOST=... PGPORT=... PGUSER=postgres bash docs/db/test/run_local.sh
set -euo pipefail
cd "$(dirname "$0")"
psql -q -c 'drop database if exists slimlog_rls_test' -c 'create database slimlog_rls_test'
psql -d slimlog_rls_test -q -v ON_ERROR_STOP=1 -f 00_supabase_stub.sql -f ../supabase_schema_draft.sql
out=$(psql -d slimlog_rls_test -q -f rls_test.sql 2>&1 | grep -E 'PASS|FAIL|ERROR' || true)
echo "$out"
echo "PASS $(grep -c PASS <<<"$out") · FAIL $(grep -c -E 'FAIL|ERROR' <<<"$out" || true)"
psql -q -c 'drop database slimlog_rls_test'
