#!/bin/bash
# Stop hook: runs all checks sequentially, writes results, sends single Windows toast notification.
# This consolidated script guarantees execution order regardless of hook framework behavior.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULT_DIR="$SCRIPT_DIR/test-results"

# ── Sync host → container (bind mount 불일치 방지) ──────────────
# 코드 수정 후 수동 실행 시에도 최신 코드로 테스트하기 위해
# node_modules, vendor, .git 등 불필요한 디렉토리는 제외
tar -C /var/app/www/cl_embed/nextjs --exclude='node_modules' --exclude='.next' --exclude='.git' --exclude='public/content' -cf - . 2>/dev/null | docker exec -i cl_embed_nextjs tar -C /app -xf - 2>/dev/null
tar -C /var/app/www/cl_embed/laravel --exclude='vendor' --exclude='node_modules' --exclude='.git' --exclude='storage/logs' --exclude='.phpunit.cache' -cf - . 2>/dev/null | docker exec -i cl_embed_laravel tar -C /var/www/html -xf -

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
