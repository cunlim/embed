---
name: fix-bug
description: 버그 수정 및 플레이라이트 재현 검증을 수행합니다
---
버그를 수정합니다: $ARGUMENTS

## 워크플로 (AGENTS.md Phase 1~5 준수)

### Phase 1: 분석
1. `/superpowers:systematic-debugging` 스킬을 활성화합니다.
2. **Playwright로 이슈 사전 재현** — `https://embed.cunlim.dev`에서 실제 이슈가 존재하는지 먼저 확인합니다.
   - 인증 필요 시 쿠키 방식 사용: `context.clearCookies()` → `page.evaluate(t => document.cookie = \`auth_token=${t}; path=/; SameSite=Lax; max-age=86400\`, token)` → `/api/auth/user` 200 확인.
3. 근본 원인을 분석하고 수정 전략을 수립합니다.
4. `AGENTS.md`의 알려진 이슈 섹션을 확인하여 이미 문서화된 문제인지 확인합니다.

### Phase 2: 수정
1. TDD 원칙 적용 — 재현 테스트를 먼저 작성(red) → 수정(green) → 리팩토링.
2. Sub-agent를 활용하여 구현합니다.
3. 프론트엔드 UI 수정 시 `ui-ux-pro-max:ui-ux-pro-max` plugin을 활성화합니다.
4. worktree 사용 시 수정 파일을 메인에 복사하고 `git status`로 확인합니다.

### Phase 3: 검증
1. `.claude/hooks/run-all-checks.sh --terminal`을 실행합니다.
2. tsc, lint, test, pint 모두 EXIT=0인지 확인합니다.
3. **Playwright로 이슈 해결 확인** — 수정 후 동일 재현步骤으로 해결되었는지 확인합니다.
4. 실패 시 즉시 수정 후 재실행합니다.

### Phase 4: 문서 갱신
1. `AGENTS.md`의 알려진 이슈에 해당 버그를 등록합니다 (이미 있으면 업데이트).
2. `docs/`, `.serena/memories/`도 검토합니다.
3. 동일 유형의 실수를 방지하기 위한 패턴을 문서화합니다.

### Phase 5: 커밋
1. 변경 사항을 분석하여 의미 있는 단위로 커밋합니다.
2. worktree가 있으면 정리합니다.
