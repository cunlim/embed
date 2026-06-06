작업을 마무리합니다. 문서 갱신과 커밋을 수행합니다.

## Phase 4: 문서 갱신
1. `/claude-md-management:revise-claude-md` 스킬을 실행합니다 (컨펌 없이 바로 적용).
2. 대상: `AGENTS.md`, `laravel/AGENTS.md`, `nextjs/AGENTS.md`, `docs/`, `.serena/memories/`, `nextjs/public/content/`
3. 이번 세션에서 배운 것을 등록하고, 중복을 제거하며, 재배치/분할/수정이 필요하면 수행합니다.
4. 코드 스캔이나 명령어로 간단하게 알 수 있는 정보는 최대한 축소합니다.

## Phase 5: 커밋
1. `/compound-engineering:ce-commit` 스킬을 실행합니다.
2. 변경 사항을 분석하여 의미 있는 단위로 커밋 메시지를 생성합니다.

## worktree 정리
- 사용한 worktree가 있으면 정리합니다: `rm -rf .claude/worktrees/* && rm -rf .git/worktrees/* && git worktree prune`
