# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참고할 가이드라인을 제공합니다.

## 문서화 언어 규칙

- **모든 문서와 주석은 한국어로 작성합니다.**
- 코드 식별자(변수명, 함수명, 클래스명 등)는 영어를 유지합니다.
- README, CLAUDE.md, AGENTS.md, PRD 등 문서 파일은 한국어로 작성합니다.
- 코드 내 주석은 한국어로 작성합니다.

## plugin, skills, mcp 사용
* 모든 프론트엔드 UI 작업은 `ui-ux-pro-max:ui-ux-pro-max` plugin을 활성화하여 수행한다.
* 구현 계획 수립, 코드 리뷰, TDD 등 구조적 접근이 필요한 작업은 `superpowers` plugin을 활성화하여 수행한다.
* 버그 수정 후 동일 유형의 실수를 방지하려면 `compound-engineering` plugin으로 학습 문서를 갱신한다.

## Subagent-Driven Development worktree 주의사항

- **worktree agent가 수정한 파일은 메인 워크트리에 "local changes"로 표시됨** — 공유 파일시스템으로 인해 worktree agent의 변경사항이 메인 워크트리에서 수정된 파일로 나타난다. `git merge <worktree-branch>` 전에 `git stash && git merge <worktree-branch> --no-edit && git stash pop`으로 머지한다.
- **worktree agent의 git commit 실패** — 서브에이전트는 권한 문제로 `git commit`에 실패하는 경우가 많다. 컨트롤러가 머지 후 직접 커밋해야 한다.
- **머지 후 worktree branch 삭제 실패** — `git branch -d <branch>`가 worktree 디렉토리 잔존으로 실패할 수 있다. `.claude/worktrees/` 디렉토리를 수동 정리한다.

## 프로젝트 개요

AI 기반 다국어 카테고리 추천 시스템. 상세는 [`docs/PRD.md`](docs/PRD.md) 참조. 진행 상황은 `phases/` 디렉토리와 `git log`로 확인.

## 카테고리 접근 제어 규칙

- **`user_id = 1`이 시스템 공개 카테고리 소유자** — 비로그인 시 `WHERE user_id = 1`만, 로그인+전체 시 `WHERE user_id IN (본인, 1)` (단, admin/superadmin은 user_id 제한 없이 전체 접근), 내 카테고리 시 `WHERE user_id = 본인`
- **모든 카테고리 조회 API는 `CategoryController::index()`와 동일한 user scope 규칙 적용** — `levels()`, RecommendController 등에서 누락 시 비로그인 사용자에게 타사용자 카테고리가 노출됨. admin/superadmin bypass도 모든 쿼리 메서드에 일관되게 적용할 것.

- **embed 페이지 토글 버튼** — 필터 모드/언어 선택/카테고리 필터 등 2~3개 옵션 전환은 `variant={active ? "default" : "ghost"}` + ghost에 `hover:bg-primary/50` + `size="sm"` + `h-7 px-2 text-xs`. 선택 항목과 hover 간 차이 최소화가 목적. Tabs 컴포넌트 사용 금지.
- **버튼 아이콘-텍스트 간격** — 모든 버튼의 아이콘과 텍스트 사이 간격은 `gap-1`(4px, 띄어쓰기 1개 수준)을 유지한다. shadcn Button base class에 `gap-1`이 적용되어 있으므로, 개별 아이콘에 `mr-*` 추가 마진을 사용하지 않는다.
- **embed 페이지 액션 버튼** — 왼쪽 영역(검색 실행, 작업 실행 등)의 동작 버튼은 `variant="default"`(기본값)를 사용한다. `variant="outline"`이나 `variant="secondary"`를 사용하지 않는다.
- **테이블 ghost icon 버튼 hover** — 목록의 수정/삭제 등 ghost icon 버튼은 `hover:bg-foreground/10 hover:text-foreground`로 오버라이드하여 light/dark 모드 모두에서 중성적인 hover 효과를 적용한다.

## Dark 모드 컴포넌트 스타일링

- **card/popover 배경 chroma 최소화** — blue 색조를 억제하고 중성적인 톤 유지 (`oklch(L 0.003 H)` 형태, chroma 0.005 이하)
- **card-background lightness 차이** — card와 background 간 lightness 차이를 0.07 이상 확보해야 카드가 배경에서 구분됨
- CSS 변수는 `app/globals.css`의 `.dark` 셀렉터에서 정의

## SSR (Server Components)

- **`useSyncExternalStore` mount guard 제거로 SSR 활성화** — `if (!mounted) return null`을 제거해도 hydration mismatch가 발생하지 않는다. React가 hydration 중 server snapshot을, 완료 후 client snapshot을 사용하기 때문.
- **SSR prefetch 시 CSR과 동일 파라미터 전달** — `page.tsx`의 API 호출이 CSR과 동일한 인자(token, filter, keyword, page, perPage)를 전달해야 SSR/CSR 불일치를 방지한다. `parseEmbedParams()`로 URL 파라미터를 SSR/CSR 공통 추출.
- **auth_token 쿠키 저장** — `useAuth.ts`의 `setToken()`이 쿠키에 토큰을 저장하므로 `page.tsx`에서 `cookies().get("auth_token")`로 읽을 수 있다. `getToken()`은 `typeof document === "undefined"` 체크로 SSR 안전 → `mounted ? getToken() : null` 불필요.
- **URL 파라미터 갱신 시 기존 파라미터 보존** — URL 동기화 함수는 `new URLSearchParams(searchParams.toString())`로 시작하여 명시된 키만 변경하고 나머지는 그대로 유지할 것. `new URLSearchParams()`로 새로 만들면 필터 토글 시 mode/cat1/page/per_page 등이 소실된다.
- **컴포넌트 props 추가 시 테스트 파일 갱신 필수** — `npm test`는 모킹으로 타입 체크를 우회하므로 테스트 파일의 prop 누락이 감지되지 않는다. `npx tsc --noEmit` 또는 `run-all-checks.sh`(`.claude/hooks/test-results/nextjs-tsc.txt`)로 반드시 확인할 것.

## 레포지토리 구조

`nextjs/`(Next.js 16), `laravel/`(Laravel 13), `docker/`(5개 서비스), `docs/`(설계 문서), `phases/`(Phase 산출물)

## 개발 프로세스

- **CRITICAL: TDD** — 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것. TDD 적용 범위와 테스트 요건은 [`laravel/CLAUDE.md`](laravel/CLAUDE.md)와 [`nextjs/CLAUDE.md`](nextjs/CLAUDE.md) 참조.
- **Phase step 완료 조건** — step의 모든 파일 생성 후 테스트 실행하여 **0 failure**를 확인해야 한다. 실패가 있으면 step을 완료할 수 없다.
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)
- **버그 수정 패턴은 파일 내 모든 발생 지점에 적용** — `create()`→`firstOrCreate()` 같은 패턴 변경 시 public 메서드만 수정하고 private 메서드를 누락하지 않도록 `grep`으로 파일 전체를 확인한다.

## Phase 운영 규칙

- **완료된 phase는 수정하지 않는다** — 모든 phase가 `completed`인 상태에서 새 기능이 여러 레이어(API+Job+Frontend)에 걸쳐 있다면 신규 phase로 생성한다. 기존 phase에 step을 추가하거나 기존 step을 수정하지 않는다.
- **신규 phase 설계 전 `phases/*/index.json` 전체 확인** — 각 phase의 step summary를 읽고 기존 구현 범위를 파악한 후 새 phase의 step을 설계할 것

## 알려진 이슈

- **컨테이너 재시작 후 HMR 불통** — `docker compose stop` + `up -d` 후 브라우저 WebSocket이 502로 끊기면 Turbopack 재컴파일이 반영되지 않는다. Playwright는 `browser.newContext()`, 수동은 Ctrl+Shift+R로 복구.
- **Subagent-Driven 시 동일 파일 작업 통합** — 여러 Task가 같은 파일을 수정하면 하나의 Agent에 통합 구현을 지시한다. 분할 dispatch 시 컨텍스트 충돌과 불필요한 재작업 발생.
- **`execute.py` spawned Claude CLI 실패** — spawned Claude CLI가 `--dangerously-skip-permissions`를 사용해도 멈추거나(hang) 컨테이너에만 구현하고 호스트 `index.json`을 갱신하지 못해 "Step did not update status"로 실패할 수 있다. 실패 시 **컨테이너에 코드가 이미 구현되어 있는지 먼저 확인**하고, 있으면 호스트로 동기화 후 index.json을 수동 갱신한다. 진행이 없으면 `kill` 후 직접 step 구현.
- **shadcn 컴포넌트 설치 시 confirm** — `echo 'y' | npx shadcn@latest add <component>`로 회피. 설치 후 `git diff --stat`으로 `package.json` 변경 확인.
- **Docker 바인드 마운트 주의사항**:
  - **동기화 불일치** — 호스트↔컨테이너 파일 변경이 즉시 반영되지 않을 수 있다. 파일 수정 후 **반드시 `wc -l`로 양쪽 라인 수를 비교**할 것.
  - **동기화는 base64 방식만 사용** — `docker exec cat > host`와 `docker cp`는 WSL2 바인드 마운트에서 0바이트 파일 생성. `cat <host> \| base64 \| docker exec -i <container> bash -c "base64 -d > <container>"` (호스트→컨테이너), 반대도 동일 패턴.
  - **신규 디렉토리** — 호스트·컨테이너 한쪽에서만 생성 시 자동 반영되지 않는다. 양쪽에 각각 `mkdir -p` 필요.
- **API 라우트에는 세션 미들웨어 없음** — `routes/api.php`는 `StartSession` 미들웨어가 기본 포함되지 않는다. `$request->session()`뿐 아니라 `$request->user()`도 web guard(세션 기반)를 사용하므로 API 컨트롤러에서 항상 null을 반환한다. 사용자 resolve가 필요하면 `$request->user('sanctum')` 또는 `auth('sanctum')->user()`를 사용할 것.
- **Swagger 문서 stale** — CI/CD 배포 후 `storage/api-docs/api-docs.json`이 갱신되지 않아 Swagger UI에 일부 엔드포인트만 표시될 수 있다. `docker exec cl_embed_laravel php artisan l5-swagger:generate`로 재생성. deploy.yml에 자동화되어 있으나 수동 작업 환경에서는 별도 실행 필요.
- **컨테이너 파일 변경 후 HMR 미감지** — `docker exec cl_embed_nextjs touch <container-path>`는 바인드 마운트에서 불안정하다. 코드 변경 후 **`.next/`를 삭제**하고 `docker compose stop` + `up -d`로 재시작할 것.
- **Pint 바인드 마운트 파일 손상** — `vendor/bin/pint`가 바인드 마운트 경로의 파일을 0바이트로 만든다. `/tmp/` 경유 방식 사용: `docker exec cl_embed_laravel bash -c 'cp /var/www/html/path/file.php /tmp/ && vendor/bin/pint /tmp/file.php && cp /tmp/file.php /var/www/html/path/'` 후 base64로 호스트 동기화.
- **테스트 DB 오염 (duplicate table/migration)** — PostgreSQL 테스트 DB에 `migration`/`users` 테이블이 이미 존재한다는 오류 발생 시 `docker exec cl_embed_laravel php artisan migrate:fresh --env=testing --force`로 초기화.
- **Playwright 인증 페이지 테스트** — `docker exec cl_embed_laravel php artisan tinker --execute 'echo \App\Models\User::first()->createToken("debug")->plainTextToken;'`로 Sanctum 토큰을 생성한 뒤, Playwright에서 `localStorage.setItem("auth_token", token)`으로 주입하고 `/embed`로 이동한다.
- **`deploy.yml` `migrate:rollback --step=1` 위험** — 모든 migration이 batch 1일 때 `--step=1`은 전체 rollback을 유발할 수 있다. migration 전 batch 번호를 기록하고 `--batch=N`으로 특정 batch만 롤백할 것.
- **테스트 DB 사용자 격리** — `dbeaver_lim_test`는 `cl_embed`에 CONNECT 권한이 없다. `.env.testing`(`DB_USERNAME=dbeaver_lim_test`)이 적용된 환경에서는 실수로 `migrate:fresh`를 실행해도 PostgreSQL이 `permission denied`를 반환하여 운영DB가 보호된다. `.env.testing`은 gitignore, `.env.testing.example`만 커밋, CI에서 `$LIVE_ROOT`로부터 복사한다.
- **`bootstrap/cache/config.php` 운영DB 오염 위험** — `php artisan config:cache` 실행 후 캐시된 설정은 `phpunit.xml`의 `<env>` 오버라이드와 `.env.testing`을 **무시**한다. 이 상태에서 `php artisan test`를 실행하면 `RefreshDatabase` trait이 운영DB에 `migrate:fresh`를 실행하여 모든 데이터가 소실된다. **반드시 `php artisan config:clear`로 캐시를 제거한 후 테스트를 실행할 것.** Stop 훅(`run-all-checks.sh`)에서 자동으로 `config:clear`를 선행 실행하도록 설정되어 있다.
- **`react-hooks/set-state-in-effect`** — URL→props→state 동기화 시 `useEffect`+`setState` 대신 `useState(initialValue)` 초기자 사용.
- **`filterRef` / `keywordRef` / `searchTextRef` 패턴** — `useCallback` async 함수에서 state 직접 참조는 stale closure 유발. `useRef`로 최신 상태를 추적하고 `ref.current`로 참조할 것. (`embed-page-inner.tsx` 참고)
- **DB 포맷은 실제 데이터로 확인** — LIKE 쿼리 작성 시 프로덕션 DB를 `psql`로 먼저 조회할 것. 구분자(예: `>` vs ` > `) 차이로 빈 결과가 발생할 수 있다. `category_name_ko`와 `onKeywordSearch` 모두 `>` 구분자(공백 없음) 사용.
- **유사도 검색 `isSearchMode` 게이트** — `isSearchMode = searchResults !== null && !keywordSearchActive`이므로 `handleSearch` 호출 시 반드시 `setKeywordSearchActive(false)`를 선행해야 한다. 누락 시 유사도 컬럼이 렌더링되지 않는다.
- **`onSelectLeafPath` 등 콜백 prop은 stale closure 주의** — 비동기 API 응답 후 실행되는 콜백에서 부모의 `displayCategories` 등 상태를 직접 참조하면 최신값이 아닐 수 있다. leaf categoryId를 API에서 직접 받아 전달하거나 ref로 우회할 것.
- **TypeScript `??`/`||` 혼합 금지** — `a ?? b || c`는 TS5076 에러. `a ?? (b || c)`처럼 괄호로 우선순위 명시할 것.
- **초기 필터 파라미터 경쟁 상태** — URL에 cat1/q 등이 있으면 부모 `useEffect`의 `loadCategories()`(keyword 없음)와 `CategoryHierarchy` mount effect의 `onKeywordSearch`(keyword 있음)가 경쟁하여 필터 없는 결과가 최종 노출된다. `skipInitialLoadRef`로 첫 로드를 건너뛰고 child mount effect에 위임할 것.

## CI/CD

- **릴리스**: `scripts/git_release.sh` (develop → main 머지 후 푸시)
- **`.env`/`.env.local`**: gitignore, CI에서 `$LIVE_ROOT`로부터 복사

## Feature Spec 3축

새 기능 구현 전 이 3개 문서의 요구사항 일관성을 반드시 확인한다:
- [`docs/PRD.md`](docs/PRD.md) — 제품 요구사항 (Why)
- [`docs/ADR.md`](docs/ADR.md) — 아키텍처 결정 (How)
- [`docs/UI_GUIDE.md`](docs/UI_GUIDE.md) — UI 명세 (What)

하위 디렉토리 CLAUDE.md: [`laravel/CLAUDE.md`](laravel/CLAUDE.md), [`nextjs/CLAUDE.md`](nextjs/CLAUDE.md), [`nextjs/AGENTS.md`](nextjs/AGENTS.md)
