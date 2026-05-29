# Task Completion — 작업 완료 검증

> 상세 내용은 `AGENTS.md` 참조.

```bash
.claude/hooks/run-all-checks.sh
cat .claude/hooks/test-results/*.txt
```

모든 파일에서 `EXIT=0` 확인 (tsc, lint, test, pint).
