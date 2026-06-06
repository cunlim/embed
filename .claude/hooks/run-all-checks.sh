#!/bin/bash
# 통합 체크 스크립트 — 모든 검사를 순차 실행하고 결과를 기록합니다.
#
# 실행 모드 (자동 감지):
#   터미널 모드: stdin이 터미널이면 결과를 터미널에 직접 출력
#   훅 모드:     stdin이 터미널이 아니면 Windows 알림 전송
#   두 모드 모두 test-results/*.txt 파일은 항상 기록됩니다.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULT_DIR="$SCRIPT_DIR/test-results"

# ── CI/CD 배포 중이면 전체 체크 건너뛰기 ────────────────────────────
if [ -f /tmp/cl_embed_deploying ]; then
  echo "CI/CD 배포 진행 중 — 모든 체크 건너뜁니다"
  exit 0
fi

# ── 실행 모드 감지 ─────────────────────────────────────────────────
# stdin이 터미널이거나 --terminal 플래그가 있으면 터미널 모드
# (자동 감지로 대부분 충분하지만, --terminal은 CI/파이프 등에서 강제 출력용)
TERMINAL_MODE=false
[ -t 0 ] && TERMINAL_MODE=true
for arg in "$@"; do
  [ "$arg" = "--terminal" ] && TERMINAL_MODE=true
done

# ── 체크 실행 헬퍼 ─────────────────────────────────────────────────
run_check() {
  local label="$1" outfile="$2"
  shift 2

  if [ "$TERMINAL_MODE" = true ]; then
    printf "  ⏳ %-30s" "$label"
  fi

  local output exit_code
  output=$("$@" 2>&1) || true; exit_code=$?
  printf '%s\nEXIT=%s\n' "$output" "$exit_code" > "$RESULT_DIR/$outfile"

  if [ "$TERMINAL_MODE" = true ]; then
    if [ "$exit_code" = "0" ]; then
      printf "\r  ✅ %-30s\n" "$label"
    else
      printf "\r  ❌ %-30s (exit=%s)\n" "$label" "$exit_code"
    fi
  fi
}

# ── 시작 ──────────────────────────────────────────────────────────
if [ "$TERMINAL_MODE" = true ]; then
  echo ""
  echo "🔍 Running all checks..."
  echo ""
fi

run_check "Next.js Lint"       "nextjs-lint.txt"  docker exec cl_embed_nextjs npm run lint
run_check "Next.js Type Check" "nextjs-tsc.txt"   docker exec cl_embed_nextjs npx tsc --noEmit
run_check "Next.js Tests"      "nextjs-test.txt"  docker exec cl_embed_nextjs sh -c "cd /app && node node_modules/vitest/vitest.mjs run --run"
run_check "Laravel Pint"       "laravel-pint.txt" docker exec cl_embed_laravel vendor/bin/pint --format agent

# 운영DB 오염 방지
docker exec cl_embed_laravel php artisan config:clear > /dev/null 2>&1

run_check "Laravel Tests"      "laravel-test.txt" docker exec cl_embed_laravel php artisan test --compact

# ── 결과 수집 ──────────────────────────────────────────────────────
get_exit() {
  tail -1 "$RESULT_DIR/$1" 2>/dev/null | grep -oP 'EXIT=\K\d+' || echo "1"
}

LINT_EXIT=$(get_exit "nextjs-lint.txt")
TSC_EXIT=$(get_exit "nextjs-tsc.txt")
NEXT_EXIT=$(get_exit "nextjs-test.txt")
PINT_EXIT=$(get_exit "laravel-pint.txt")
LARAVEL_EXIT=$(get_exit "laravel-test.txt")

# ── 결과 요약 계산 ──────────────────────────────────────────────────
FAIL_COUNT=0
for code in "$LINT_EXIT" "$TSC_EXIT" "$NEXT_EXIT" "$PINT_EXIT" "$LARAVEL_EXIT"; do
  [ "$code" != "0" ] && FAIL_COUNT=$((FAIL_COUNT + 1))
done

# ── 항상 stdout 출력 ───────────────────────────────────────────────
# 결과는 모드와 관계없이 항상 터미널에 출력 (AI·사람 모두 확인 가능)
if [ "$TERMINAL_MODE" = true ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo " 📋 Check Results"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  print_row() {
    local icon="✅"
    [ "${2:-0}" != "0" ] && icon="❌"
    printf "  %s %-25s EXIT=%s\n" "$icon" "$1" "${2:-0}"
  }

  print_row "Next.js Lint"       "$LINT_EXIT"
  print_row "Next.js Type Check" "$TSC_EXIT"
  print_row "Next.js Tests"      "$NEXT_EXIT"
  print_row "Laravel Pint"       "$PINT_EXIT"
  print_row "Laravel Tests"      "$LARAVEL_EXIT"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [ "$FAIL_COUNT" -eq 0 ]; then
    echo " 🎉 All checks passed!"
  else
    echo " ⚠️  ${FAIL_COUNT} check(s) failed."
  fi
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
else
  # 비터미널 모드: compact 한 줄 요약
  if [ "$FAIL_COUNT" -eq 0 ]; then
    echo "✅ All checks passed (lint, tsc, test, pint)"
  else
    echo "❌ ${FAIL_COUNT} check(s) failed — lint:${LINT_EXIT} tsc:${TSC_EXIT} test:${NEXT_EXIT} pint:${PINT_EXIT} laravel:${LARAVEL_EXIT}"
  fi
fi

# ── 훅 모드에서만 Windows 알림 추가 전송 ────────────────────────────
if [ "$TERMINAL_MODE" != true ]; then
  ~/.claude/hooks/notify-checks.sh "cl_embed" "ClaudeCodeTestResults" \
    "lint:${LINT_EXIT}" "tsc:${TSC_EXIT}" \
    "Next.js test:${NEXT_EXIT}" "pint:${PINT_EXIT}" \
    "Laravel test:${LARAVEL_EXIT}"
fi

exit 0
