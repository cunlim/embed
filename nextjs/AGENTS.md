# nextjs/AGENTS.md

## 프로젝트 개요

AI 기반 다국어 카테고리 추천 시스템의 프론트엔드.
Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui (`base-nova` 스타일).

- **접근 URL**: `https://embed.cunlim.dev` (Cloudflare tunnel) / `http://localhost:3000` (Docker 포트 바인딩)

## 명령어

**모든 명령어는 Docker 컨테이너에서 실행** — host에는 TypeScript 등 의존성이 설치되어 있지 않음.

```bash
# 자주 사용
docker exec cl_embed_nextjs npm run <dev|build|lint|test>
docker exec cl_embed_nextjs npx tsc --noEmit
docker exec cl_embed_nextjs npx eslint <files> --max-warnings=0

# shadcn 컴포넌트 추가 (--overwrite 사용 시 기존 컴포넌트 덮어쓰기 주의)
docker exec cl_embed_nextjs npx shadcn@latest add <component> -y
```

## Vercel Next Dev Tools MCP

Next.js 16 전용 MCP 서버. 런타임 진단, 라우트 정보, 캐시 관리, 브라우저 기반 페이지 검증 제공.

- **세션 시작 시 `init` 호출 필수** — MCP 컨텍스트 초기화.
- **페이지 검증은 `browser_eval` 사용** — curl 대신 브라우저 자동화로 JS 실행·hydration·콘솔 에러 포착.
- **에러 진단**: `nextjs_index` → `nextjs_call(get_errors)` → `browser_eval(console_messages)`.

## 디자인 시스템

디자인 컨벤션은 [`docs/UI_GUIDE.md`](../docs/UI_GUIDE.md) 참조. 구현 변경 시 문서가 stale일 수 있으므로 실제 코드 상태를 우선한다.

- **RadioGroup 미사용** — shadcn/ui에 RadioGroup 컴포넌트가 설치되어 있지 않음. 라디오 버튼이 필요하면 커스텀 스타일 버튼으로 구현.

## Next.js 16 주요 함정

> `node_modules/next/dist/docs/`의 공식 문서를 먼저 읽고 브레이킹 체인지를 숙지할 것.

1. **App Router만 사용** — `pages/` 디렉토리 사용 안 함
2. **기본값: Server Components** — 실시간 인터랙션이 필요한 곳만 `"use client"` 추가
3. **async 컴포넌트** — `getServerSideProps` / `getStaticProps` 없음
4. **Metadata API** — `<Head>` 대신 `export const metadata`
5. **fetch 캐싱** — 기본 비캐시. 캐싱 필요 시 명시적 `cache: "force-cache"`

## ESLint 주요 규칙

- **`react-hooks/set-state-in-effect`** — useEffect 내 동기적 setState 금지 (0-tolerance)
  - 데이터 fetch는 훅이 mount 시 자동 로드 — effect에서 수동 호출 금지
  - eslint-disable 주석: `// eslint-disable-next-line react-hooks/set-state-in-effect`
- **`react-hooks/refs`** — `useRef`의 `.current` render 중 사용 금지. 콜백 ref는 `useEffect(() => { ref.current = callback })` 사용.
  - **모달 open 초기화 패턴**: `useRef`로 이전 `open` 상태 추적 → render 중 조건부 `setState`는 `eslint-disable-next-line react-hooks/refs` 필요
- **`useSearchParams`는 `<Suspense>` 경계 필수** — 빌드 시 오류 발생

## useEffect 무한 루프 방지

- **`useSearchParams()`가 새 객체 반환 시** (테스트 mock 등) effect 내 `setState`가 무한 루프 유발. `resetDoneRef` 패턴으로 1회만 실행하도록 guard 필요.
- **effect에서 부모 콜백 호출 금지** — `onKeywordSearch()`, `onFilterChange()` 등 부모 state를 변경하는 콜백을 effect에서 호출하면 `react-hooks/preserve-manual-memoization` 에러 발생. 로컬 상태만 리셋하고, 부모 콜백은 `EmbedPageInner`에서 직접 호출.
- **`resetKey` prop 패턴** — `refreshKey`(옵션 재조회)와 별도로 `resetKey`(상태 완전 초기화)를 분리. `resetKey` effect에서는 부모 콜백 없이 로컬 상태만 리셋 + 옵션 재조회.
- **`setLevelOptions` 자식 depth 보존** — `refreshKey`/`resetKey` effect에서 `setLevelOptions([opts])` 호출 시 자식 depth 옵션이 삭제됨. `setLevelOptions((prev) => prev.length > 1 ? [opts, ...prev.slice(1)] : [opts])`로 함수형 업데이트하여 보존.
- **`resetKey` 초기 옵션 즉시 설정** — `setLevelOptions([])`로 초기화하면 fetch 완료 전까지 "사용 가능한 카테고리가 없습니다" 플래시 발생. `initialLevelOptions`가 있으면 즉시 설정 후 fetch로 갱신.
- **커스텀 이벤트로 즉시 리셋 패턴** — `<Link>` 네비게이션 지연 시 `window.dispatchEvent(new CustomEvent("resetEmbedPage"))`로 즉시 상태 초기화 가능. `embed-page-inner.tsx`에서 `window.addEventListener`로 수신. URL 동기화는 `window.history.replaceState()`로 처리 (React 상태 배치 지연 없이 즉시 반영).
- **모달 자동 open 제거 시 `onSelectLeafPath` 확인** — `CategoryHierarchy`의 `onSelectCategory`만 제거하면 `EmbedPageInner`의 `onSelectLeafPath` 콜백이 `setModalCategoryId`를 호출하여 모달이 열림. 양쪽 모두 제거 필요.

## URL 파라미터 상태 동기화

- **`"" || undefined` 함정** — 빈 문자열(`""`)이 falsy이므로 `keyword || undefined`가 `undefined`로 변환됨. `useCategories.loadCategories`의 `search ?? currentSearch.current`가 stale fallback을 반환. **해결**: `|| undefined` 대신 ref 원시값 직접 전달.
- **파생 값을 ref로 추적하면 잔여 상태 감지 실패** — `effectiveFilter`(`"my"` | `undefined`)를 `useRef`로 추적하면, "전체" 선택 시 `effectiveFilter = undefined` → `filterRef.current = undefined` → `hasResidual` 체크에서 누락. **원본 state(`filterSelection`)를 추적**해야 함.
- **nullable state의 잔여 체크는 `!== null`** — `"all" | "my" | null` 타입을 ref로 추적 시 `!== undefined` 체크는 `null !== undefined === true`로 항상 잔여로 감지. `!== null`로 변경.
- **URL 파라미터에서 파생된 useState는 reset effect에서 명시적 초기화 필요** — `perPage`처럼 URL에서 파생되어 `useState`로 관리되는 값은 URL이 비워져도 state가 자동 리셋되지 않음. reset effect에 `setPerPage(20)` 등 명시적 초기화 추가.
- **`activeFilterSelection`의 `serverFilter` 폴백 함정** — `filterSelection ?? (serverFilter === "my" ? "my" : "all")`에서 `serverFilter`는 SSR 시점 스냅샷. `setFilterSelection(null)` 후에도 서버 초기값으로 되돌아감. **해결**: `useState`에서 이미 초기 반영되므로 폴백에서 `serverFilter` 제거 → `activeFilterSelection = filterSelection`.
- **`router.replace()`·`router.push()` 비동기 지연** — Next.js App Router에서 `router.replace()`·`router.push()`는 비동기적(React 상태 배치 + 네비게이션 처리). `searchParams`는 렌더링 시점 스냅샷이므로 같은 이벤트 핸들러 내 연속 호출 시 stale 값을 읽어 race condition 발생. 언어 radio·필터·페이지 변경 등 10곳 이상의 액션에서 URL이 1~5초 지연. **해결**: `window.history.replaceState()`·`pushState()`로 즉시 URL 업데이트. `searchParams.toString()` 대신 `window.location.search` 읽기. `page`는 computed 값 → `useState`로 전환하여 즉시 반영. `resetToDefault`·`handlePageChange`·per-page select·`updateURL` 모두 적용. `<Link>`와 동시 실행 충돌도 동일 원인.

## 초기 마운트 시 reset effect 함정

- **`resetDoneRef` 효과의 잔여 상태 오판 판정** — `filterRef`는 `filterSelection`에서 초기화되므로, SSR에서 `filterSelection="my"`이면 `filterRef.current="my"`. URL이 비어있는 초기 마운트에서 `hasResidual = filterRef.current !== null`이 `true`가 되어 불필요한 리셋 트리거 → `loadCategories(1, 20, undefined, "")` 호출로 필터 없는 전체 목록이 "내 카테고리"를 덮어씀. **해결**: `initialMountDoneRef`로 첫 마운트 시 reset effect를 건너뜀.
- **`filterSelection` nullable 기본값 → radio 버튼 미선택** — `useState<"all" | "my" | null>`에서 `serverFilter`가 `null`이면 초기값 `null`. 비로그인 시 `"all"`과 `"my"` 모두 `aria-pressed=false`가 되어 어떤 버튼도 선택되지 않음. **해결**: 타입에서 `null` 제거, 기본값을 `"all"`로 설정 (`props.serverFilter === "my" ? "my" : "all"`). `defaultFilterRef`도 동일하게 수정.
- **`hadServerCategories` 소비 타이밍** — `effectiveFilter`가 `undefined`인 첫 렌더에서 `hadServerCategories.current=false`가 되면, 이후 `effectiveFilter="my"`로 변경되어도 SSR 데이터 보호가 불가. reset effect 수정 시 `hadServerCategories` 소비 조건에 `effectiveFilter` 확정 여부를 함께 체크할 것.

## SSR/CSR 일관성

- **SSR 사용자 prefetch** — `layout.tsx`에서 `cookies()` → `getUser(token)` → client component에 `serverUser` prop 전달. `useAuth(initialUser)`로 hydration 시 `null`→`user` 전환 깜빡임 방지.
- **`skipInitialFetch` ref** — SSR prefetch 완료 시 `useAuth`의 `useEffect`가 `getUser(token)`을 중복 호출하지 않도록 `useRef(!!initialUser)`로 첫 effect skip.
- **`isLoading` + `!!token` hydration mismatch** — `useState(!!token)`으로 초기화하면 서버(`getToken()`=null → `false`)와 클라이언트(쿠키 → `true`) 불일치로 hydration 에러. `useAuth`·`useApiKeys`·`useUsageStats` 등 토큰 기반 데이터 fetch 훅 모두 해당. **해결**: `useState(false)`로 고정, `useEffect` 내 `setIsLoading(true)` + fetch.
- **`canModify` SSR/CSR 일관성** — `user ?? serverUser`로 양쪽에서 동일한 소유권 판단. SSR 시 `serverUser`, CSR hydration 후 `useAuth().user` 사용.
- **클라이언트 측 강제 리디렉션은 `window.location.href`** — 전체 페이지 로드로 layout SSR 재실행 → `serverUser` 갱신. OAuth 콜백은 middleware가 먼저 처리하므로 로그아웃·토큰 만료 등 제한적 상황에만 해당.
- **`useSyncExternalStore` mount 감지 금지** — SSR에서 `return null`로 깜빡임 유발. 서버 컴포넌트 인증 게이트 또는 `initialUser` + `skipInitialFetch`로 대체.
- URL을 state의 source of truth로 — `useSearchParams()` 변경 감지 → URL→state 단방향 싱크
- `useCallback` 내 stale state 방지를 위해 ref로 최신값 읽기 (`searchLangRef`, `perPageRef` 등)
- 컴포넌트 props 추가 시 `npx tsc --noEmit` 확인 (npm test는 모킹으로 타입 체크 우회)
- **`getToken()`은 SSR 시 `null`** — `typeof document === "undefined"` 체크로 인해 서버에서 항상 `null`. client component 내 조건부 렌더링은 `token` 대신 `serverHadToken` prop 사용 (`!!(await cookies()).get("auth_token")?.value`).

## 인증 페이지 SSR 깜빡임 방지

- **서버 컴포넌트 인증 게이트** — 인증이 필요한 페이지는 async 서버 컴포넌트 + `cookies()` → `getUser(token)` → `redirect()`. SSR 단계에서 인증 실패 시 HTTP 307만 반환하고 어떤 HTML도 클라이언트에 전송하지 않음. 클라이언트 컴포넌트는 `serverUser` prop을 `useAuth(initialUser)`로 받아 별도 인증 체크 불필요.
- **`cookies().set()`은 서버 컴포넌트에서 불가** — "Cookies can only be modified in a Server Action or Route Handler" 에러. 쿠키 설정이 필요한 redirect는 **middleware** 사용.
- **Middleware 쿠키+리다이렉트** — OAuth 콜백 등 URL 파라미터 토큰을 쿠키로 설정 후 리다이렉트: `middleware.ts`에서 `searchParams.get("token")` → `response.cookies.set("auth_token", token)` → `NextResponse.redirect(...)`. 페이지 렌더링 전 처리로 깜빡임 제로.

## Docs 페이지 시스템

- **`/docs?doc=SLUG`** 단일 라우트, 서버 컴포넌트(`app/docs/page.tsx`) + 클라이언트 레이아웃(`app/docs/layout.tsx`)
- **문서 등록**: `lib/docs.ts` → `docList` 배열에 `{ slug, title, description }` 추가
- **콘텐츠**: `public/content/{SLUG}.md` — react-markdown + remark-gfm 렌더링
- **사이드바**: `CollapsibleSidebar` + `<Suspense>` → `useSearchParams().get("doc")` 으로 active 표시
- **문서 목록** (2026-06-06): USER_GUIDE, API_V1, SIMILARITY_SEARCH, RESUME

### Docs·콘텐츠 페이지 SSR 패턴

- **URL을 state의 source of truth로** — `useSearchParams()` + `<Link>`로 Context/useState 대체. 사이드바 selected와 문서 콘텐츠 모두 URL에서 파생.
- **페이지 서버 컴포넌트 전환** — `"use client"` 제거, async 서버 컴포넌트 + `searchParams`(Promise)로 파라미터 수신. `fs.readFile`로 서버에서 콘텐츠 직접 로드.
- **클라이언트/서버 공유 데이터** — `lib/` 모듈에 공통 타입·상수 추출. layout(클라이언트)과 page(서버) 양쪽에서 import.
- **`generateMetadata` + `searchParams`** — 문서별 `<title>`·OG 태그 SSR 제공.

## 테스트

**CRITICAL: 프론트엔드도 TDD를 적용한다.** 새 훅, 유틸리티 함수, API 클라이언트 추가 시 테스트를 먼저 작성.

Vitest + React Testing Library + jsdom 구성. 테스트 디렉토리:
- `lib/__tests__/*.test.ts` — 순수 함수, API 클라이언트
- `hooks/__tests__/*.test.ts` — 커스텀 훅 (renderHook 사용)

- **shadcn Select는 `<select>`가 아님** — `role="combobox"` 기반. Playwright에서 옵션 클릭 사용.
- **`CardTitle`은 `<div>`** — `role="heading"` 없음. `getByText()` 사용.
- **`vitest` 바이너리 직접 실행 금지** — `--no-bin-links`로 `node_modules/.bin/vitest` 미생성. `npm test` 사용.
- **`vitest run` 전체 실행 타임아웃** — Docker 내에서 `npx vitest run` 전체 실행 시 hang 발생 가능. 개별 파일 실행은 정상 동작. 검증 시 개별 파일별로 실행하거나 `timeout` 사용.

## 알려진 이슈

- **반응형 레이아웃 hydration mismatch** — JS 조건부 렌더링(`if (isDesktop)`)은 서버/클라이언트 값 불일치로 hydration 에러 발생. CSS 기반(`hidden lg:block`)으로 전환하거나 `useSyncExternalStore`의 `getServerSnapshot` 사용.
- **`next-themes` + React 19 `<script>` 경고** — `next-themes` 0.4.6가 React 컴포넌트 내부에서 `<script>` 태그를 렌더링. React 19에서 "Encountered a script tag while rendering React component" 경고 발생. `<html suppressHydrationWarning>` 적용되어 있으나 이 경고는 별개. 라이브러리 업데이트 전까지 개발 모드 경고로 유지.
- **shadcn `--overwrite` 플래그** — 기존 컴포넌트를 새 버전으로 덮어씀. button.tsx의 `asChild` prop 등 호환성 깨질 수 있음. 사용 후 `git diff` 확인 필수.
- **`--accent`는 text 색상으로 부적합** — light/dark 모두 `oklch(0.45)` 동일 명도. 테마 자동 적응 text에는 `text-foreground` 사용. 배경색(`bg-accent/10`, `bg-accent/20`)으로만 사용할 것.
- **Laravel API 응답 형식 불일치** — `Resource::collection()`은 `{data: [...]}`, 단일은 `{data: {...}}`. 인터페이스 정의 시 Network 탭으로 확인.
- **`.claude/settings.json` Stop hook에 `npm run build` 금지** — BUILD_ID 생성으로 dev 모드 이탈.
- **JS 청크 캐싱 (Cloudflare)** — `_next/static/*`이 `max-age=14400`. 개발 환경은 Cache Rule 바이패스.
- **HTML 페이지 캐시 (Cache-Control)** — `next.config.ts`의 `headers()`에서 `/:path*`에 `no-cache` 설정. 미설정 시 브라우저가 SSR HTML을 캐시하여 cookie 기반 UI 변경이 F5에 반영 안 됨 (Ctrl+F5 필요). `no-cache`는 브라우저가 매번 서버에 재검증(`If-None-Match`)하도록 강제 — 304 응답 가능하므로 성능 영향 최소화.
- **OAuth 콜백 `?token=`** — middleware에서 `response.cookies.set("auth_token", token)` + `NextResponse.redirect`로 서버사이드 처리. 페이지 렌더링 전 완료되어 깜빡임 없음.
- **`--no-bin-links`** — Docker 볼륨 마운트 환경에서 npm 심볼릭 링크 생성 불가.
- **outline 버튼 light 모드 hover** — `hover:bg-muted hover:text-foreground`로 덮어쓸 것.
- **ThemeToggle SSR 깜빡임** — `useSyncExternalStore` + `opacity-0` invisible 버튼 패턴 사용 금지. SSR에서도 실제 버튼 렌더링.
- **컨테이너 재생성 후** — `docker compose stop` + `up -d` 후 `npm run build`로 타입 체크 확인.
- **CSS 트랜지션 사이드바 패턴** — 접기/펼치기 시 `{!collapsed && <nav>}` 조건부 렌더링은 width 트랜지션 중 텍스트 래핑으로 높이 깨짐 발생. 해결: nav에 `h-0 overflow-hidden` 적용, 자식 버튼에 `whitespace-nowrap overflow-hidden` 추가. shadcn Sheet의 `showCloseButton` 기본값이 `true` — 커스텀 닫기 버튼 사용 시 `showCloseButton={false}` 필수.

  - **SSR 사이드바 깜빡임 (localStorage → cookie 동기화)** — `localStorage`는 서버에서 읽을 수 없어, SSR은 항상 기본값(펼침)으로 렌더링. 클라이언트 hydration 후 localStorage 값을 읽어 상태를 업데이트하면서 `duration-300` 애니메이션이 적용되어 사이드바가 펼쳐졌다 접히는 깜빡임 발생. **해결**: (1) toggle 시 localStorage + cookie 양쪽에 저장 (`document.cookie = ...; path=/; SameSite=Lax; max-age=31536000`). (2) layout을 Server Component로 전환 → `cookies()`로 초기 상태 읽기 → `initialCollapsed` prop으로 클라이언트에 전달. (3) `getServerSnapshot`에서 `initialCollapsed` 반환 → SSR이 올바른 상태로 렌더링. (4) 첫 마운트 시 `requestAnimationFrame` 2프레임 후 `setSuppressTransition(false)`로 transition 활성화 — 초기 동기화 중 애니메이션 억제. localStorage ↔ cookie 양방향 동기화 (첫 마운트 시 어느 한쪽에만 값이 있어도 보정). 상세: `components/collapsible-sidebar.tsx`.
- **폼 버튼 순서 컨벤션** — 입력 폼에서 초기화 버튼은 검색 버튼 앞에 배치: `Input → 초기화(X) → 검색(Search)`. 검색 버튼이 disabled일 때도 초기화 버튼이 보이도록 조건부 렌더링 순서 준수.
- **async batch 진행률 `flushSync` 패턴** — React 19 batching 우회를 위해 `import { flushSync } from "react-dom"`으로 루프 내 모든 `setProgress`를 감쌈. **task-execution 구조**: Phase 1(확인)은 `POST /api/categories/batch-status`로 대체. `steps[]`로 checkbox 전달 → 서버가 missing_steps 계산. progress bar는 Phase 2(run-step 실행)만 100%로 표시. 상세: `task-execution.tsx`·`laravel/AGENTS.md` 참조.
- **`fetchCategoryTranslations` `noPreview` 옵션** — `noPreview: true` 전달 시 `?no_preview=true`로 임베딩 벡터 제외. 카테고리 모달 상세 조회 시 사용. 배치 작업은 `batch-status` API로 대체됨. 상세: `api.ts`·`useCategoryDetail.ts` 참조.
- **batch `onComplete`·`onCategoryComplete` 콜백 패턴** — 콜백 내 `effectiveFilter`는 클로저 값 사용. 배치 중 필터 변경 대비해 `filterRef.current === "my" ? "my" : undefined`로 ref에서 읽을 것. `onComplete`는 `loadCategories(1, perPage, ...)` 호출 후 `updateURL({ page: 1 })`로 URL 동기화 필수. `onCategoryComplete`는 루프 중 `loadCategories` 호출 금지 — URL의 page=N이 API 요청에 붙는 버그 유발. `CategoryDelete`도 동일 패턴. `stepsRef.current`·`hierarchyLangRef.current`도 reload 시 전달.
- **`loadCategories` `searchLang` 파라미터 전파** — `loadCategories` 8번째 인자 `searchLang`은 분류선택 모드에서 백엔드 `search_lang` 쿼리 파라미터로 전달. `hierarchyLangRef.current`로 최신값 읽기. **⚠️ `handleKeywordSearch`에서는 전달 금지** — 검색 모드의 키워드 검색은 모든 언어 컬럼에서 부분 검색(`%검색어%`)이어야 하므로 `search_lang`을 보내면 prefix 매칭(`검색어>%`)이 적용되어 결과가 없음. `handleStepsChange`·페이지 변경·폴더/삭제 완료 핸들러 등 분류선택 컨텍스트가 유지되는 호출 지점에서만 전달.
- **TaskExecution `onStepsChange` + 기본 해제** — `checkedSteps` 기본값 `new Set()` (빈 값). 체크박스 토글 시 `onStepsChange(steps)` 콜백 → `EmbedPageInner`의 `handleStepsChange`가 `stepsRef` 갱신 + `loadCategories(1, ..., steps)`로 page=1 리셋. **`toggleStep`은 `setCheckedSteps` updater 내부가 아닌 외부에서 `onStepsChange` 호출** (updater purity 규칙). `steps` 파라미터는 `api.ts` → `useCategories` → `embed-page-inner.tsx` 모든 `loadCategories` 호출 지점에 전파. 상세: 루트 `AGENTS.md`.
- **progress `initialTotalSteps` 패턴** — `BatchProgress` interface에 `initialTotalSteps` 필드 추가. 큐 구성 시 `queue.length` 저장, `queueEmpty` 시에도 0으로 초기화하지 않음. progress 오른쪽 `[N/M]`은 카테고리 수 대신 step 수 기준.
- **task-execution 단계별 재시도** — `MAX_RETRIES=2`(총 3회), `RETRY_DELAY_MS=1000`(시도 간 지수 증가: 1s→2s→4s). `status:"failed"`(422 등)는 재시도 안 함. `STEP_DELAY_MS=2000`(단계 간 지연, Ollama 부하 방지). `handleRetry`는 `retryParamsRef`로 파라미터 보존 후 `fetchBatchStatus` 재호출 → stale 데이터 대신 fresh 상태로 재실행.
- **`ApiError` 클래스** — `api.ts`에서 HTTP status 보존을 위해 `Error` 상속. `request()`에서 `res.status` 포함 throw → caller에서 422(`status:"failed"` 반환) vs 500(재시도) 판별 가능.
- **`request()` 204 No Content 처리** — DELETE 등 204 응답은 body가 없어 `res.json()` 호출 시 `SyntaxError` 발생. `if (res.status === 204) return undefined as T;`로 조기 반환 필수.
- **Dialog `handleSubmit` error swallowing** — 부모 `onSubmit`이 toast 표시 후 re-throw하는 패턴에서 Dialog의 `handleSubmit`에 `catch {}`를 추가하지 않으면 uncaught rejection 콘솔 에러 발생. `catch { /* toast already shown */ }` 패턴 사용.
- **`moveCategoriesToFolder` `targetUserId`** — 관리자가 다른 회원 폴더로 이동 시 `target_user_id`를 API에 전달. 프론트 `folder-section.tsx`에서 composite value(`"폴더명:userId"`) 파싱해 추출. 누락 시 folder만 변경되고 user_id 불변.
- **비로그인 사이드바 섹션 auth-gating** — `{serverHadToken && (...)}` 패턴으로 추가·다운로드·삭제 섹션 감춤. 유사도 검색·필터·작업 실행은 비로그인에도 표시. 기존 폴더 섹션과 동일 패턴.
- **setState updater 내 부수 효과 금지** — `setState(prev => { ... })` updater 함수는 순수해야 함 (React Strict Mode에서 2회 호출로 오염 검출). updater 내부에서 `onStepsChange` 등 콜백을 통해 `loadCategories`(자체 setState + API 호출)를 호출하면 "Cannot update a component (`%s`) while rendering a different component (`%s`)" 에러 + API 2회 중복 호출 발생. `task-execution.tsx` `toggleStep`이 대표 사례. **해결**: updater 밖에서 클로저로 새 상태 계산 → `setState(next)` → 부수 효과 별도 호출. `onStepsChange?.(Array.from(nextSteps))`를 updater 외부로 이동.
- **useCallback + setState stale closure** — 이벤트 핸들러에서 setState 후 동기 호출되는 useCallback은 이전 render의 state를 캡처. 해결: useRef로 최신 값 추적 → 핸들러에서 ref 먼저 업데이트 → 콜백은 ref 읽고 의존성에서 state 제거.
- **비동기 reload 전 `setState([])`로 stale guard** — 데이터 소스 변경(예: 회원 전환) 후 `loadData()` 호출 전에 `setData([])`로 즉시 초기화. 비동기 로드 완료 전 stale 데이터로 인한 false-positive 중복 체크 방지.
- **`onFolderChange` 호출 후 `onFolderActionComplete` 호출 금지** — `onFolderChange`가 이미 올바른 폴더명으로 `loadCategories` 트리거. `onFolderActionComplete`는 `selectedFolderRef.current`를 사용하는데 `onFolderChange` 내 `setSelectedFolder`가 아직 render에 반영되지 않아 stale ref로 빈 결과를 덮어쓰는 레이스 컨디션 발생. 삭제·수정(rename) 모두 해당.
- **폴더 Select** — 두 Select(메인·이동) 스타일 동기화. `loadFolders()`는 `grouped` 응답 위해 userId 없이 호출. 상세: 루트 `AGENTS.md` 및 `[[frontend/core]]`.
- **Admin 사이드바 작업 피드백** — 모든 폴더·카테고리 작업(추가/수정/삭제/이동/처리)은 `sonner` `toast()`로 결과 통계 표시. 성공 `toast.success()`, 일부 실패 `toast.warning()`, 에러 `toast.error()`. inline `setError()`와 병행. 폴더 이동은 API 응답 `{ moved, failed, message }`를 그대로 toast에 전달.
- **`addCategory()` folder 전파** — `folder` 파라미터를 `useCategories.addCategory()` → `createCategory()` → API까지 전달 필수. 누락 시 기본폴더로 생성됨.
- **`addCategory()` 에러 re-throw** — hook 내부에서 catch 후 `setError`만 호출하면 caller가 성공/실패를 구분할 수 없어 입력값이 항상 초기화됨. hook에서 `throw err`로 재전파 후 caller에서 try/catch로 감싸 성공 시에만 input 초기화.
- **`resetToDefault` selectedIds 누락** — `resetToDefault()` 호출 시 필터·검색어·페이지뿐 아니라 `setSelectedIds(new Set())`으로 체크박스도 초기화 필수.
- **`resetToDefault` 폴더 상태 누락** — `resetToDefault()`에서 `selectedFolder`·`selectedUserId`를 `null`로 초기화 필수. 미적용 시 폴더 select가 옵션에 없는 stale 값("테스트폴더" 등) 표시. `loadCategories()` 호출 시에도 folder·userId에 stale 값 대신 `undefined` 전달.
- **`resetToDefault` hierarchyLang 초기화** — `resetToDefault()`에서 `setHierarchyLang("ko")`로 분류선택 언어도 초기화 필수. 미적용 시 기본 언어로 복원되지 않음.
- **SSR page.tsx 파라미터 전파 누락** — `embed-page-inner.tsx` prop 추가 시 SSR `page.tsx`의 prefetch 호출에도 동일 파라미터 전달 필요.
- **분류선택 언어 변경 `handleLangChange` 패턴** — `CategoryHierarchy`에서 언어 변경 시: ①`selectedPath`·`loadingStates`·`keywordText` 초기화 (**`levelOptions`는 유지** — 빈 배열로 설정하면 `hasOptions=false`가 되어 필터 섹션이 통째로 사라짐 → 깜빡임 유발), ②`onKeywordSearch("")`로 카테고리 목록 초기화, ③`onLangChange(lang, mode, catPath, keyword)`로 부모에 **언어+필터 상태를 한 번에 전달** (별도 `reportFilterChange` 호출 시 `updateURL`가 두 번 실행되어 두 번째 호출이 첫 번째의 `lang` 설정을 덮어씀), ④새 언어로 `fetchCategoryLevels({ lang })` 재조회. 부모(`EmbedPageInner`)에서는 `setHierarchyLang` + `updateURL({ hierarchyLang, searchMode, catPath, likeQuery })`로 상태·URL 단일 동기화.
- **URL 파라미터 언어 독립** — `lang`(분류선택 계층 언어)은 `CategoryHierarchy`에서 관리. 기본값 `ko`이고, `ko`일 때 URL에서 삭제.
- **SelectTrigger 기본 height**: `data-[size=default]:h-8` (32px). 인접 버튼 height 불일치 방지 위해 `h-8`로 통일 (`h-9` 사용 시 4px 차이).
- **Flex 내 truncate는 `min-w-0` 필수** — flex 아이템 기본 `min-width: auto`가 `truncate` CSS를 무력화. `SelectTrigger` 등 flex 레이아웃 내 truncation 필요 시 부모 컨테이너에 `min-w-0` 추가.
- **Playwright shadcn Select** — `browser_select_option`은 native `<select>` 전용. shadcn Select(role="combobox")는 `browser_run_code_unsafe` + `async (page) => {...}`로 조작. `window.fetch` monkey-patch로 API 호출 스택 추적 가능.
- **E2E 테스트 설정** — `playwright.config.ts`에서 `dotenv`로 `.env.local` 자동 로드. `E2E_BASE_URL`(대상 URL), `E2E_TOKEN`(superadmin 토큰)은 `.env.local`에 설정, `.env.example`에 문서화. 실행: `npx playwright test`. 인증: `e2e/helpers/auth.ts`의 `setupAuth()` 사용.
- **ESLint `react-hooks/set-state-in-effect` 데이터 fetch 패턴** — useEffect에서 `loadApiKeys()` 등 비동기 함수를 직접 호출하면 함수 내부의 setState가 동기적으로 트리거되어 에러. **해결**: `async function init() { await loadApiKeys(); }`로 래핑하여 effect body를 비동기로 처리. `useApiKeys`·`useUsageStats` 등 모든 데이터 fetch 훅에 적용.
- **`Math.random()` render 중 호출 금지** — React pure component 규칙 위반. skeleton loading 등에서 랜덤 height 필요 시 `(i * 17 + 13) % 50` 등 결정적 수식 사용.
- **Hook에서 직접 `fetch()` 호출 금지** — `api.ts`에 중앙화된 함수(`runStep` 등)를 사용. 직접 `fetch()`하면 API URL 구성·인증 헤더·에러 처리 로직이 이중 관리됨. 테스트도 `global.fetch` mocking 대신 `vi.mock("@/lib/api")` + `vi.mocked(fn)` 패턴 사용.
- **데이터 시각화 값 레이블** — 차트·그래프는 시각적 요소(바, 선)만으로 불충분. 막대 바로 위에 `absolute` + `bottom: calc(height% + 2px)`로 막대 높이에 맞춰 라벨 배치. **PC/모바일 양립**: hover(`group-hover:opacity-100`) + click toggle(`useState<activeDate>` + `onClick` 토글 + 외부 클릭 감지 `useEffect`로 dismiss). 라벨에 `pointer-events-none` 적용하여 바 클릭을 가로채지 않게 할 것.
- **마이페이지 `/mypage`** — 독립 경로. 서버 컴포넌트에서 `auth_token` 쿠키 확인 → `getUser(token)` → 미인증 시 `/login?redirect=/mypage`로 리다이렉트. 헤더 닉네임에 `<Link href="/mypage">` 연결.
- **관리자 회원 관리** — URL 기반 라우팅: `admin/layout.tsx`에서 `Link` + `usePathname()`으로 네비게이션. MENU: `/admin`(시스템 설정, Settings 아이콘), `/admin/member`(회원 관리, Users 아이콘). 각 페이지는 독립 서버 컴포넌트에서 SSR 인증 게이트(`cookies()` → `getUser()` → `redirect()`) 적용. `user-detail-modal.tsx`에서 `getAdminUserDetail()` → 기본정보 + API 사용량 + key별 사용량 + 쿼타 조절. `QuotaAdjustDialog`에서 `type=absolute|increment`로 절대값/증감 조절. **⚠️ 응답 구조**: 백엔드가 평탄 구조(`{ data: { id, name, ..., total_calls, ... } }`)를 반환하므로 `setDetail(res.data)`로 바로 사용 가능.
- **관리자 시스템 설정 `api` 그룹** — `settings-panel.tsx`에서 `GROUP_LABELS`·`FIELD_LABELS`에 `api` 그룹 추가됨. `free_quota`(무료 호출 회수), `rate_limit_per_minute`(분당 호출 제한) 표시. 새 설정 추가 시 백엔드 `AdminSettingsController::GROUPS` + 프론트 `GROUP_LABELS`·`FIELD_LABELS` 양쪽 업데이트 필수.
- **마이페이지 API 타입 패턴** — `getUsageStats` 등 마이페이지 API는 백엔드가 `{ data: {... } }` 래퍼로 반환. `request()`는 raw JSON을 그대로 반환하므로, 호출 측에서 `res.data`로 언래핑 필수. **`ApiKeyItem.key`는 optional** — 백엔드 `#[Hidden(['key'])]`로 제외되므로, 생성 시에만 `makeVisible('key')`로 노출. `key` 있을 때만 복사 버튼 표시하고, amber 배지 `"새로고침 전 복사하세요"`로 사용자에게 고지. 생성 성공 toast에도 `description`으로 경고 추가. **상태 업데이트 시 `key` 보존**: `{ ...prev, ...response.data }`로 스프레드하여 hidden 필드 소실 방지.
- **Turbopack middleware 소스맵 디버깅** — Next.js 16의 middleware는 Edge Runtime으로 실행되며 Turbopack이 `server/edge/chunks/`에 번들링. 소스맵 경로가 `turbopack:///[project]/*` 프리픽스를 사용하므로, `launch.json`의 `sourceMapPathOverrides` + `"turbopack:///[project]/*": "${workspaceFolder}/*"` 추가 필수. 미적용 시 middleware.ts breakpoint가 동작하지 않음.
- **일반 카테고리 목록 페이징 API 파라미터 일관성** — Next.js 프론트엔드가 카테고리 목록 조회 API(`getCategories`) 호출 시 `page_number`와 `page_size` 쿼리 파라미터를 전송한다. Laravel 백엔드가 기본 `page` 대신 `page_number` 파라미터를 사용하도록 `paginate($perPage, ['*'], 'page_number')` 형식으로 파라미터 이름을 지정해서 호출해주어야 페이지네이션이 정상 작동한다.

- 디자인 가이드: [`docs/UI_GUIDE.md`](../docs/UI_GUIDE.md)
- 아키텍처 결정 기록: [`docs/ADR.md`](../docs/ADR.md)
- 제품 요구사항: [`docs/PRD.md`](../docs/PRD.md)
