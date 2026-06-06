#!/bin/bash
# Stop hook: runs all checks sequentially, writes results, sends single Windows toast notification.
# This consolidated script guarantees execution order regardless of hook framework behavior.
#
# 실행 모드:
#   훅 모드 (자동): stdin이 터미널이 아님 → Windows 알림 전송
#   터미널 모드 (수동): stdin이 터미널 또는 --terminal 플래그 → 결과를 터미널에 직접 출력
#   두 모드 모두 test-results/*.txt 파일은 항상 기록됩니다.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULT_DIR="$SCRIPT_DIR/test-results"

# ── 실행 모드 감지 ─────────────────────────────────────────────
# --terminal 플래그가 있거나 stdin이 터미널이면 터미널 모드
TERMINAL_MODE=false
for arg in "$@"; do
  [ "$arg" = "--terminal" ] && TERMINAL_MODE=true
done
[ -t 0 ] && TERMINAL_MODE=true

# ── CI/CD 배포 중이면 전체 체크 건너뛰기 ────────────────────────────
DEPLOY_FLAG="/tmp/cl_embed_deploying"
if [ -f "$DEPLOY_FLAG" ]; then
  echo "CI/CD 배포 진행 중 — 모든 체크 건너뜁니다"
  exit 0
fi

# ── 진행 표시 (터미널 모드에서만) ───────────────────────────────
log_step() {
  if [ "$TERMINAL_MODE" = true ]; then
    printf "  ⏳ %-30s" "$1"
  fi
}

log_done() {
  if [ "$TERMINAL_MODE" = true ]; then
    local exit_code="$1"
    if [ "$exit_code" = "0" ]; then
      printf "\r  ✅ %-30s\n" "$2"
    else
      printf "\r  ❌ %-30s (exit=%s)\n" "$2" "$exit_code"
    fi
  fi
}

# ── 시작 ────────────────────────────────────────────────────────
if [ "$TERMINAL_MODE" = true ]; then
  echo ""
  echo "🔍 Running all checks..."
  echo ""
fi

# ── Next.js Lint ──────────────────────────────────────────────
log_step "Next.js Lint"
OUTPUT=$(docker exec cl_embed_nextjs npm run lint 2>&1); EXIT=$?
printf '%s\nEXIT=%s\n' "$OUTPUT" "$EXIT" > "$RESULT_DIR/nextjs-lint.txt"
log_done "$EXIT" "Next.js Lint"

# ── Next.js Type Check ────────────────────────────────────────
log_step "Next.js Type Check"
OUTPUT=$(docker exec cl_embed_nextjs npx tsc --noEmit 2>&1); EXIT=$?
printf '%s\nEXIT=%s\n' "$OUTPUT" "$EXIT" > "$RESULT_DIR/nextjs-tsc.txt"
log_done "$EXIT" "Next.js Type Check"

# ── Next.js Tests ─────────────────────────────────────────────
log_step "Next.js Tests"
OUTPUT=$(docker exec cl_embed_nextjs sh -c "cd /app && node node_modules/vitest/vitest.mjs run --run 2>&1"); EXIT=$?
printf '%s\nEXIT=%s\n' "$OUTPUT" "$EXIT" > "$RESULT_DIR/nextjs-test.txt"
log_done "$EXIT" "Next.js Tests"

# ── Laravel Pint ──────────────────────────────────────────────
log_step "Laravel Pint"
OUTPUT=$(docker exec cl_embed_laravel vendor/bin/pint --format agent 2>&1); EXIT=$?
printf '%s\nEXIT=%s\n' "$OUTPUT" "$EXIT" > "$RESULT_DIR/laravel-pint.txt"
log_done "$EXIT" "Laravel Pint"

# ── Laravel Config Cache Clear (운영DB 오염 방지) ──────────────
docker exec cl_embed_laravel php artisan config:clear 2>&1 > /dev/null

# ── Laravel Tests ─────────────────────────────────────────────
log_step "Laravel Tests"
OUTPUT=$(docker exec cl_embed_laravel php artisan test --compact 2>&1); EXIT=$?
printf '%s\nEXIT=%s\n' "$OUTPUT" "$EXIT" > "$RESULT_DIR/laravel-test.txt"
log_done "$EXIT" "Laravel Tests"

# ── 결과 수집 ──────────────────────────────────────────────────
LINT_EXIT=$(tail -1 "$RESULT_DIR/nextjs-lint.txt" 2>/dev/null | grep -oP 'EXIT=\K\d+')
TSC_EXIT=$(tail -1 "$RESULT_DIR/nextjs-tsc.txt" 2>/dev/null | grep -oP 'EXIT=\K\d+')
NEXT_EXIT=$(tail -1 "$RESULT_DIR/nextjs-test.txt" 2>/dev/null | grep -oP 'EXIT=\K\d+')
PINT_EXIT=$(tail -1 "$RESULT_DIR/laravel-pint.txt" 2>/dev/null | grep -oP 'EXIT=\K\d+')
LARAVEL_EXIT=$(tail -1 "$RESULT_DIR/laravel-test.txt" 2>/dev/null | grep -oP 'EXIT=\K\d+')

# ── 모드별 출력 ────────────────────────────────────────────────
if [ "$TERMINAL_MODE" = true ]; then
  # 터미널 모드: 결과 테이블 출력
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo " 📋 Check Results"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  print_row() {
    local label="$1" exit_code="${2:-0}"
    local icon="✅"
    [ "$exit_code" != "0" ] && icon="❌"
    printf "  %s %-25s EXIT=%s\n" "$icon" "$label" "$exit_code"
  }

  print_row "Next.js Lint"      "${LINT_EXIT:-0}"
  print_row "Next.js Type Check" "${TSC_EXIT:-0}"
  print_row "Next.js Tests"      "${NEXT_EXIT:-0}"
  print_row "Laravel Pint"       "${PINT_EXIT:-0}"
  print_row "Laravel Tests"      "${LARAVEL_EXIT:-0}"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # 최종 판정
  FAIL_COUNT=0
  for code in "${LINT_EXIT:-0}" "${TSC_EXIT:-0}" "${NEXT_EXIT:-0}" "${PINT_EXIT:-0}" "${LARAVEL_EXIT:-0}"; do
    [ "$code" != "0" ] && FAIL_COUNT=$((FAIL_COUNT + 1))
  done

  if [ "$FAIL_COUNT" -eq 0 ]; then
    echo " 🎉 All checks passed!"
  else
    echo " ⚠️  ${FAIL_COUNT} check(s) failed."
    echo ""
    echo " Failed details:"
    [ "${LINT_EXIT:-0}" != "0" ]      && echo "   • nextjs-lint.txt"
    [ "${TSC_EXIT:-0}" != "0" ]       && echo "   • nextjs-tsc.txt"
    [ "${NEXT_EXIT:-0}" != "0" ]      && echo "   • nextjs-test.txt"
    [ "${PINT_EXIT:-0}" != "0" ]      && echo "   • laravel-pint.txt"
    [ "${LARAVEL_EXIT:-0}" != "0" ]   && echo "   • laravel-test.txt"
  fi
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
else
  # 훅 모드: Windows 알림 전송 (기존 동작)
  ~/.claude/hooks/notify-checks.sh "cl_embed" "ClaudeCodeTestResults" \
    "lint:${LINT_EXIT:-0}" "tsc:${TSC_EXIT:-0}" \
    "Next.js test:${NEXT_EXIT:-0}" "pint:${PINT_EXIT:-0}" \
    "Laravel test:${LARAVEL_EXIT:-0}"
fi

exit 0
