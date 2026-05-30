# AGENTS.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참고할 가이드라인을 제공합니다.

## 문서화 언어 규칙

- **모든 문서와 주석은 한국어로 작성합니다.**
- 코드 식별자(변수명, 함수명, 클래스명 등)는 영어를 유지합니다.

## 언어 순서 규칙

- **모든 UI·API에서 언어 순서는 `ko → en → zh`(한영중)로 통일** — 토글 버튼, 모달, API 응답, SQL foreach 등 신규 요소 추가 시 이 순서 준수.

## plugin, skills, mcp 사용

* 모든 프론트엔드 UI 작업은 `ui-ux-pro-max:ui-ux-pro-max` plugin을 활성화하여 수행한다.
* 구현 계획 수립, 코드 리뷰, TDD 등 구조적 접근이 필요한 작업은 `superpowers` plugin을 활성화하여 수행한다.
* 버그 수정 후 동일 유형의 실수를 방지하려면 `compound-engineering` plugin으로 학습 문서를 갱신한다.

## 작업 워크플로

- **이슈 사전 재현** — 수정 작업 전 Playwright로 실제 이슈가 존재하는지 먼저 확인한다.
- **Sub-agent driven** — 구현은 되도록 Agent(Sub-agent)를 활용한다.
- **Playwright 테스트 URL** — WSL2 호스트에서 `https://embed.cunlim.dev`로 접속 (Next.js 포트 미공개).
- **Playwright 인증** — 쿠키 기반(`auth_token`). superadmin 필요 시 `User::where('role','superadmin')->first()`로 조회 (자세한 절차는 `laravel/AGENTS.md` 참조). 쿠키 설정은 `context.clearCookies()` + `context.addCookies()` 사용 (중복 쿠키 방지).
- **작업 완료 전 검증** — `.claude/hooks/run-all-checks.sh` 실행 후 `cat .claude/hooks/test-results/*.txt`로 결과 확인. tsc, lint, test, pint 모두 EXIT=0 확인 후 마무리.

## 문서 우선순위

- **3축 기준 문서** — `PRD`(Why/What), `ADR`(How), `UI_GUIDE`(UI). `docs/superpowers/specs`와 `plans`는 작업 기록. 기준 문서와 충돌 시 실제 코드 우선.

## Subagent-Driven Development worktree 주의사항

- **worktree agent 수정 파일은 메인에 미반영** — `cp <worktree-path> <main-path>`로 수동 동기화. 완료 후 `git -C <메인-repo> status`로 누락 확인.
- **worktree agent의 git commit 실패** — 컨트롤러가 머지 후 직접 커밋.
- **머지 후 worktree branch 삭제 실패** — `rm -rf .git/worktrees/<name>` 후 `git branch -D <branch>`.
- **worktree agent 사용 전 stale worktree 정리** — `rm -rf .claude/worktrees/* && rm -rf .git/worktrees/* && git worktree prune`.

## Docker

- **base64 방식만 사용** — `docker exec cat > host`와 `docker cp`는 WSL2 바인드 마운트에서 0바이트 파일 생성.
- **컨테이너 재시작 후 HMR 불통** — WebSocket 502. `browser.newContext()` 또는 Ctrl+Shift+R.
- **컨테이너 파일 변경 후 HMR 미감지** — `.next/` 삭제 후 `docker compose stop` + `up -d`.
- **Pint 바인드 마운트 파일 손상** — `/tmp/` 경유 방식 사용.

## 카테고리 접근 제어

- **user scope 규칙** — `user_id=1`(공개), 비로그인: 본인+공개, 로그인: 본인+공개, admin: 전체. 모든 카테고리 조회 API(`levels()`, `recommend()` 등)에 동일 적용.

## 알려진 이슈

- **Sub-agent 인터페이스 수정 시 중복 코드** — api.ts 등 interface에 필드 추가 시 agent가 이전 블록을 삭제하지 않고 새 블록을 중복 생성할 수 있음. `tsc --noEmit`은 통과해도 dev server parse error 발생. 수정 후 `grep`으로 중복 키 확인.
- **Docker 바인드 마운트 불일치** — 호스트·컨테이너 간 파일 변경 즉시 반영 안 될 수 있음. 수정 후 `wc -l`로 양쪽 라인 수 비교.
- **신규 디렉토리** — 호스트·컨테이너 한쪽만 생성 시 자동 반영 안 됨. 양쪽 `mkdir -p`.
- **Subagent-Driven 동일 파일 작업** — 여러 Task가 같은 파일을 수정하면 하나의 Agent에 통합.

## 유틸리티

- `scripts/cosine_similarity.py` — 두 임베딩 벡터 JSON 배열로 코사인 유사도 계산. `python scripts/cosine_similarity.py '[...]' '[...]'`

## CI/CD

- **릴리스**: `scripts/git_release.sh` (develop → main 머지 후 푸시)
- **`.env`/`.env.local`**: gitignore, CI에서 `$LIVE_ROOT`로부터 복사

## 하위 디렉토리

- 백엔드: [`laravel/AGENTS.md`](laravel/AGENTS.md)
- 프론트엔드: [`nextjs/AGENTS.md`](nextjs/AGENTS.md)
