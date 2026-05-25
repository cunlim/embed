# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참고할 가이드라인을 제공합니다.

## 문서화 언어 규칙

- **모든 문서와 주석은 한국어로 작성합니다.**
- 코드 식별자(변수명, 함수명, 클래스명 등)는 영어를 유지합니다.

## plugin, skills, mcp 사용
* 모든 프론트엔드 UI 작업은 `ui-ux-pro-max:ui-ux-pro-max` plugin을 활성화하여 수행한다.
* 구현 계획 수립, 코드 리뷰, TDD 등 구조적 접근이 필요한 작업은 `superpowers` plugin을 활성화하여 수행한다.
* 버그 수정 후 동일 유형의 실수를 방지하려면 `compound-engineering` plugin으로 학습 문서를 갱신한다.

## 작업 워크플로

- **이슈 사전 재현** — 수정 작업 전 Playwright로 실제 이슈가 존재하는지 먼저 확인한다.
- **Sub-agent driven** — 구현은 되도록 Agent(Sub-agent)를 활용한다.
- **Playwright 테스트 URL** — WSL2 호스트에서 `https://embed.cunlim.dev`로 접속 (Next.js 포트 미공개).
- **작업 완료 전 검증** — `.claude/hooks/run-all-checks.sh`를 실행하여 tsc, lint, test, pint를 모두 통과하는지 확인하고 이슈가 있으면 해결 후 마무리한다.

## Subagent-Driven Development worktree 주의사항

- **worktree agent 수정 파일은 메인 워크트리에 "local changes"로 표시** — 공유 파일시스템 이슈. `git stash && git merge <branch> --no-edit && git stash pop`으로 머지.
- **worktree agent의 git commit 실패** — 서브에이전트가 권한 문제로 commit 실패 시, 컨트롤러가 머지 후 직접 커밋.
- **머지 후 worktree branch 삭제 실패** — `rm -rf .git/worktrees/<name>` 후 `git branch -D <branch>`.
- **worktree agent 사용 전 stale worktree 정리** — `rm -rf .claude/worktrees/* && rm -rf .git/worktrees/* && git worktree prune`.

## 프로젝트 개요

AI 기반 다국어 카테고리 추천 시스템. `nextjs/`(Next.js 16, `/app/` 경로), `laravel/`(Laravel 13, `/var/www/html/` 경로), `docker/`(5개 서비스), `docs/`(설계 문서).

## 컨테이너 파일 동기화

- **base64 방식만 사용** — `docker exec cat > host`와 `docker cp`는 WSL2 바인드 마운트에서 0바이트 파일 생성. `cat <host> | base64 | docker exec -i <container> bash -c "base64 -d > <container-path>"`.
- **Next.js 컨테이너 경로**: `/app/`, **Laravel 컨테이너 경로**: `/var/www/html/`.
- **컨테이너 재시작 후 HMR 불통** — `docker compose stop` + `up -d` 후 브라우저 WebSocket 502. Playwright는 `browser.newContext()`, 수동은 Ctrl+Shift+R.
- **컨테이너 파일 변경 후 HMR 미감지** — `.next/` 삭제 후 `docker compose stop` + `up -d`.
- **Pint 바인드 마운트 파일 손상** — `/tmp/` 경유: `docker exec cl_embed_laravel bash -c 'cp /var/www/html/path/file.php /tmp/ && vendor/bin/pint /tmp/file.php && cp /tmp/file.php /var/www/html/path/'` 후 base64로 호스트 동기화.
- **shadcn 컴포넌트 설치 시 confirm** — `echo 'y' | npx shadcn@latest add <component>`.

## 카테고리 접근 제어

- **`user_id = 1`이 시스템 공개 카테고리 소유자** — 비로그인 시 `WHERE user_id = 1`만, 로그인+전체 시 `WHERE user_id IN (본인, 1)`, admin/superadmin은 제한 없음.
- **모든 카테고리 조회 API는 `CategoryController::index()`와 동일한 user scope 규칙 적용** — `levels()`, RecommendController 등에서 누락 금지.

## Embed 페이지 UI 패턴

- **토글 버튼** — `variant={active ? "default" : "ghost"}` + ghost에 `hover:bg-primary/50` + `size="sm"` + `h-7 px-2 text-xs`. Tabs 사용 금지.
- **버튼 아이콘-텍스트 간격** — shadcn Button base class에 `gap-1` 이미 적용. 개별 `mr-*` 금지.
- **액션 버튼** — 왼쪽 영역(검색 실행, 작업 실행 등)은 `variant="default"`. `variant="outline"`/`"secondary"` 금지.
- **테이블 ghost icon hover** — `hover:bg-foreground/10 hover:text-foreground`로 오버라이드.
- **shadcn Button `[&_svg]:size-4`** — icon에 `size-3` 대신 `!size-3` 사용해야 적용됨.

## Dark 모드

- **card/popover 배경 chroma 최소화** — `oklch(L 0.003 H)`, chroma 0.005 이하.
- **card-background lightness 차이** — 0.07 이상 확보.
- CSS 변수는 `app/globals.css`의 `.dark` 셀렉터에서 정의.

## SSR (Server Components)

- **SSR prefetch 시 CSR과 동일 파라미터** — `parseEmbedParams()`로 URL 파라미터 SSR/CSR 공통 추출.
- **URL 파라미터 갱신 시 기존 파라미터 보존** — `new URLSearchParams(searchParams.toString())`로 시작.
- **컴포넌트 props 추가 시 `npx tsc --noEmit` 확인** — `npm test`는 모킹으로 타입 체크 우회.

## 개발 프로세스

- **커밋 메시지**: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`)
- **Phase step 완료 조건** — 0 failure 테스트 확인. 실패 시 step 완료 불가.
- **완료된 phase는 수정하지 않음** — 새 기능은 신규 phase로 생성.
- **버그 수정 패턴은 파일 내 모든 발생 지점에 적용** — `grep`으로 전체 확인.

## Feature Spec 3축

새 기능 구현 전 확인: [`docs/PRD.md`](docs/PRD.md) (Why), [`docs/ADR.md`](docs/ADR.md) (How), [`docs/UI_GUIDE.md`](docs/UI_GUIDE.md) (What)

## 유틸리티

- `scripts/cosine_similarity.py` — 두 임베딩 벡터 JSON 배열로 코사인 유사도 계산. `python scripts/cosine_similarity.py '[...]' '[...]'`

## 알려진 이슈

> Laravel/Next.js 특화 이슈는 각 하위 `CLAUDE.md` 참조.

- **Docker 바인드 마운트 불일치** — 호스트·컨테이너 간 파일 변경 즉시 반영 안 될 수 있음. 수정 후 `wc -l`로 양쪽 라인 수 비교.
- **신규 디렉토리** — 호스트·컨테이너 한쪽만 생성 시 자동 반영 안 됨. 양쪽 `mkdir -p`.
- **Subagent-Driven 동일 파일 작업** — 여러 Task가 같은 파일을 수정하면 하나의 Agent에 통합.
- **`execute.py` spawned Claude CLI 실패** — 컨테이너에 코드 구현 여부 먼저 확인. 있으면 호스트 동기화 후 index.json 갱신. 없으면 `kill` 후 직접 구현.
- **DB 포맷은 실제 데이터로 확인** — LIKE 쿼리 전 `psql`로 프로덕션 DB 조회. `category_name_ko` 구분자는 `>` (공백 없음).

## CI/CD

- **릴리스**: `scripts/git_release.sh` (develop → main 머지 후 푸시)
- **`.env`/`.env.local`**: gitignore, CI에서 `$LIVE_ROOT`로부터 복사

하위 디렉토리: [`laravel/CLAUDE.md`](laravel/CLAUDE.md), [`nextjs/CLAUDE.md`](nextjs/CLAUDE.md), [`nextjs/AGENTS.md`](nextjs/AGENTS.md)
