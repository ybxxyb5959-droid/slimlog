#!/usr/bin/env bash
# 로컬 Supabase(CLI)에서 RLS 테스트 + Auth·Storage 통합 테스트 실행
#   사전: npx supabase start   (마이그레이션 자동 적용)
set -euo pipefail
cd "$(dirname "$0")/../.."
status=$(npx -y supabase status -o env)
get() { grep "^$1=" <<<"$status" | cut -d= -f2- | tr -d '"'; }
echo "== RLS·제약 (SQL)"
PGPASSWORD=postgres psql "$(get DB_URL)" -q -f supabase/tests/rls_test.sql 2>&1 | grep -oE '(PASS|FAIL|ERROR).*' | tee /tmp/slimlog-rls.out
pass=$(grep -c ^PASS /tmp/slimlog-rls.out || true); bad=$(grep -cE '^(FAIL|ERROR)' /tmp/slimlog-rls.out || true)
echo "PASS $pass · FAIL $bad (기대 46개)"
[ "$pass" -eq 46 ] && [ "$bad" -eq 0 ] || { echo "RLS 테스트 실패"; exit 1; }
echo "== Auth·Storage·REST (HTTP)"
SUPABASE_URL=$(get API_URL) SUPABASE_ANON_KEY=$(get ANON_KEY) SUPABASE_SERVICE_ROLE_KEY=$(get SERVICE_ROLE_KEY) node supabase/tests/integration.mjs
