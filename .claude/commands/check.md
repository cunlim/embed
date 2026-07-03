---
name: check
description: Run all validation checks (lint, tsc, test, pint)
---
전체 검사를 실행합니다.

`.claude/hooks/run-all-checks.sh --terminal`을 실행하고 결과를 확인합니다.

- tsc, lint, test, pint 모두 EXIT=0이어야 합니다.
-任何一个 체크가 실패하면 즉시 수정 후 재실행합니다.
- 모두 통과할 때까지 반복합니다.
