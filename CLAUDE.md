# CLAUDE.md

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
- **작업 완료 전 검증** — `.claude/hooks/run-all-checks.sh` 실행 후 `cat .claude/hooks/test-results/*.txt`로 결과 확인. tsc, lint, test, pint 모두 EXIT=0 확인 후 마무리.

## Subagent-Driven Development worktree 주의사항

- **worktree agent 수정 파일은 메인에 미반영** — worktree는 별도 파일 복사본. Docker exec(컨테이너는 메인 repo 마운트)로 수정한 파일만 메인에 반영되고, Edit 도구로 직접 수정한 파일은 worktree에만 존재. `cp <worktree-path> <main-path>`로 수동 동기화. 완료 후 `git -C <메인-repo> status`로 누락 확인.
- **worktree agent의 git commit 실패** — 서브에이전트가 권한 문제로 commit 실패 시, 컨트롤러가 머지 후 직접 커밋.
- **머지 후 worktree branch 삭제 실패** — `rm -rf .git/worktrees/<name>` 후 `git branch -D <branch>`.
- **worktree agent 사용 전 stale worktree 정리** — `rm -rf .claude/worktrees/* && rm -rf .git/worktrees/* && git worktree prune`.

## 프로젝트 개요

AI 기반 다국어 카테고리 추천 시스템. 상세는 [`docs/PRD.md`](docs/PRD.md) 참조. 진행 상황은 `phases/` 디렉토리와 `git log`로 확인.

## Docker

- **base64 방식만 사용** — `docker exec cat > host`와 `docker cp`는 WSL2 바인드 마운트에서 0바이트 파일 생성.
- **컨테이너 재시작 후 HMR 불통** — WebSocket 502. `browser.newContext()` 또는 Ctrl+Shift+R.
- **컨테이너 파일 변경 후 HMR 미감지** — `.next/` 삭제 후 `docker compose stop` + `up -d`.
- **Pint 바인드 마운트 파일 손상** — `/tmp/` 경유 방식 사용.

## 카테고리 접근 제어

- **`user_id = 1`이 시스템 공개 카테고리 소유자** — 비로그인 시 `WHERE user_id = 1`만, 로그인+전체 시 `WHERE user_id IN (본인, 1)`, admin/superadmin은 제한 없음.
- **모든 카테고리 조회 API는 `CategoryController::index()`와 동일한 user scope 규칙 적용** — `levels()`, RecommendController 등에서 누락 금지.

> Next.js 특화 UI 패턴, SSR, Dark 모드는 [`nextjs/CLAUDE.md`](nextjs/CLAUDE.md) 참조.

## 페이지 공통 배경 패턴

- **5개 페이지가 동일한 배경 요소 사용** — `noise-overlay` + `bg-grid` + `glow-orb` ×2. `app/page.tsx`, `embed`, `login`, `admin`, `docs` 모두 이 패턴 공유.
- **glow-orb 색상은 페이지마다 다름** — 랜딩페이지는 blue+purple, embed·login 등은 다른 색상. 색상은 각 페이지의 Tailwind 클래스로 지정.
- **`gradient-text`는 랜딩페이지 부제목용** — blue→orange 그라데이션. 장식 제거 시에도 보존 대상.
- **globals.css 클래스 삭제 전 확인** — `grep -r "클래스명" app/`으로 모든 사용처 확인 후 삭제.

## 개발 프로세스

- **커밋 메시지**: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`)
- **Phase step 완료 조건** — 0 failure 테스트 확인. 실패 시 step 완료 불가.
- **완료된 phase는 수정하지 않음** — 새 기능은 신규 phase로 생성.

## Feature Spec 3축

새 기능 구현 전 확인: [`docs/PRD.md`](docs/PRD.md) (Why), [`docs/ADR.md`](docs/ADR.md) (How), [`docs/UI_GUIDE.md`](docs/UI_GUIDE.md) (What)

## 유틸리티

- `scripts/cosine_similarity.py` — 두 임베딩 벡터 JSON 배열로 코사인 유사도 계산. `python scripts/cosine_similarity.py '[...]' '[...]'`

## 알려진 이슈

- **Sub-agent 인터페이스 수정 시 중복 코드** — api.ts 등 interface에 필드 추가 시 agent가 이전 블록을 삭제하지 않고 새 블록을 중복 생성할 수 있음. `tsc --noEmit`은 통과해도 dev server parse error 발생. 수정 후 `grep`으로 중복 키 확인.

> Laravel/Next.js 특화 이슈는 각 하위 `CLAUDE.md` 참조.

- **Docker 바인드 마운트 불일치** — 호스트·컨테이너 간 파일 변경 즉시 반영 안 될 수 있음. 수정 후 `wc -l`로 양쪽 라인 수 비교.
- **신규 디렉토리** — 호스트·컨테이너 한쪽만 생성 시 자동 반영 안 됨. 양쪽 `mkdir -p`.
- **Subagent-Driven 동일 파일 작업** — 여러 Task가 같은 파일을 수정하면 하나의 Agent에 통합.

- **DB 포맷은 실제 데이터로 확인** — LIKE 쿼리 전 `psql`로 프로덕션 DB 조회. `category_name_ko` 구분자는 `>` (공백 없음).

- **PostgreSQL RANK() + LEFT JOIN 함정** — `RANK() OVER (ORDER BY ...)`는 LEFT JOIN 결과가 NULL이어도 전체 결과셋에서 순위를 반환한다. Service에서 `distance`가 null이면 `rank`도 null로 명시적 처리 필요 (`RecommendationService` 참고).

## CI/CD

- **릴리스**: `scripts/git_release.sh` (develop → main 머지 후 푸시)
- **`.env`/`.env.local`**: gitignore, CI에서 `$LIVE_ROOT`로부터 복사

하위 디렉토리: [`laravel/CLAUDE.md`](laravel/CLAUDE.md), [`nextjs/CLAUDE.md`](nextjs/CLAUDE.md), [`nextjs/AGENTS.md`](nextjs/AGENTS.md)
