---
name: new-feature
description: 신규 기능 구현을 수행합니다
---
신규 기능을 작업합니다: $ARGUMENTS

## 워크플로 (AGENTS.md Phase 1~5 준수)

### Phase 1: 계획 수립
1. `/superpowers:brainstorming` 스킬을 활성화하여 요구사항을 분석하고 설계합니다.
2. `docs/`의 PRD, ADR, UI_GUIDE를 참조하여 기존 아키텍처와 일치하는지 확인합니다.
3. 구현 계획을 수립하고 작업 단위를 분해합니다.
4. TDD 원칙(red → green → refactor)을 적용합니다.
5. 병렬 가능한 작업은 Sub-agent로 분해합니다.

### Phase 2: 구현
1. Sub-agent를 활용하여 구현합니다.
2. 프론트엔드 UI 작업 시 `ui-ux-pro-max:ui-ux-pro-max` plugin을 활성화합니다.
3. worktree 사용 시 수정 파일을 메인에 복사하고 `git status`로 확인합니다.

### Phase 3: 검증
1. `.claude/hooks/run-all-checks.sh --terminal`을 실행합니다.
2. tsc, lint, test, pint 모두 EXIT=0인지 확인합니다.
3. 실패 시 즉시 수정 후 재실행합니다.

### Phase 4: 문서 갱신
1. `AGENTS.md`, `docs/`, `.serena/memories/`, `nextjs/public/content/`를 검토합니다.
2. 이번 세션에서 배운 것을 등록하고, 중복을 제거합니다.

### Phase 5: 커밋
1. 변경 사항을 분석하여 의미 있는 단위로 커밋합니다.
2. worktree가 있으면 정리합니다.
