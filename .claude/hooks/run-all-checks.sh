#!/bin/bash
# Stop hook: runs all checks sequentially, writes results, sends single Windows toast notification.
# This consolidated script guarantees execution order regardless of hook framework behavior.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULT_DIR="$SCRIPT_DIR/test-results"

# ── CI/CD 배포 중이면 전체 체크 건너뛰기 ────────────────────────────
DEPLOY_FLAG="/tmp/cl_embed_deploying"
if [ -f "$DEPLOY_FLAG" ]; then
  echo "CI/CD 배포 진행 중 — 모든 체크 건너뜁니다"
  exit 0
fi

# ── Next.js Lint ──────────────────────────────────────────────
OUTPUT=$(docker exec cl_embed_nextjs npm run lint 2>&1); EXIT=$?
printf '%s\nEXIT=%s\n' "$OUTPUT" "$EXIT" > "$RESULT_DIR/nextjs-lint.txt"

# ── Next.js Type Check ────────────────────────────────────────
OUTPUT=$(docker exec cl_embed_nextjs npx tsc --noEmit 2>&1); EXIT=$?
printf '%s\nEXIT=%s\n' "$OUTPUT" "$EXIT" > "$RESULT_DIR/nextjs-tsc.txt"

# ── Next.js Tests ─────────────────────────────────────────────
OUTPUT=$(docker exec cl_embed_nextjs sh -c "cd /app && node node_modules/vitest/vitest.mjs run --run 2>&1"); EXIT=$?
printf '%s\nEXIT=%s\n' "$OUTPUT" "$EXIT" > "$RESULT_DIR/nextjs-test.txt"

# ── Laravel Pint ──────────────────────────────────────────────
OUTPUT=$(docker exec cl_embed_laravel vendor/bin/pint --format agent 2>&1); EXIT=$?
printf '%s\nEXIT=%s\n' "$OUTPUT" "$EXIT" > "$RESULT_DIR/laravel-pint.txt"

# ── Laravel Tests ─────────────────────────────────────────────
OUTPUT=$(docker exec cl_embed_laravel php artisan test --compact 2>&1); EXIT=$?
printf '%s\nEXIT=%s\n' "$OUTPUT" "$EXIT" > "$RESULT_DIR/laravel-test.txt"

# ── Build Notification ────────────────────────────────────────
LINT_EXIT=$(tail -1 "$RESULT_DIR/nextjs-lint.txt" 2>/dev/null | grep -oP 'EXIT=\K\d+')
TSC_EXIT=$(tail -1 "$RESULT_DIR/nextjs-tsc.txt" 2>/dev/null | grep -oP 'EXIT=\K\d+')
NEXT_EXIT=$(tail -1 "$RESULT_DIR/nextjs-test.txt" 2>/dev/null | grep -oP 'EXIT=\K\d+')
PINT_EXIT=$(tail -1 "$RESULT_DIR/laravel-pint.txt" 2>/dev/null | grep -oP 'EXIT=\K\d+')
LARAVEL_EXIT=$(tail -1 "$RESULT_DIR/laravel-test.txt" 2>/dev/null | grep -oP 'EXIT=\K\d+')

~/.claude/hooks/notify-checks.sh "cl_embed" "ClaudeCodeTestResults" \
  "lint:${LINT_EXIT:-0}" "tsc:${TSC_EXIT:-0}" \
  "Next.js test:${NEXT_EXIT:-0}" "pint:${PINT_EXIT:-0}" \
  "Laravel test:${LARAVEL_EXIT:-0}"

exit 0
