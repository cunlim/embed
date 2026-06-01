# nextjs/AGENTS.md

## 프로젝트 개요

AI 기반 다국어 카테고리 추천 시스템의 프론트엔드.
Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui (`base-nova` 스타일).

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
- **`router.replace()`와 `<Link>` 네비게이션 동시 실행 충돌** — 같은 URL로 `router.replace()`와 `<Link>`가 동시에 실행되면 서로 취소되어 URL 변경 안 됨. 즉시 URL 동기화가 필요하면 `window.history.replaceState()` 사용.

## 초기 마운트 시 reset effect 함정

- **`resetDoneRef` 효과의 잔여 상태 오판 판정** — `filterRef`는 `filterSelection`에서 초기화되므로, SSR에서 `filterSelection="my"`이면 `filterRef.current="my"`. URL이 비어있는 초기 마운트에서 `hasResidual = filterRef.current !== null`이 `true`가 되어 불필요한 리셋 트리거 → `loadCategories(1, 20, undefined, "")` 호출로 필터 없는 전체 목록이 "내 카테고리"를 덮어씀. **해결**: `initialMountDoneRef`로 첫 마운트 시 reset effect를 건너뜀.
- **`hadServerCategories` 소비 타이밍** — `effectiveFilter`가 `undefined`인 첫 렌더에서 `hadServerCategories.current=false`가 되면, 이후 `effectiveFilter="my"`로 변경되어도 SSR 데이터 보호가 불가. reset effect 수정 시 `hadServerCategories` 소비 조건에 `effectiveFilter` 확정 여부를 함께 체크할 것.

## SSR/CSR 일관성

- **SSR 사용자 prefetch** — `layout.tsx`에서 `cookies()` → `getUser(token)` → client component에 `serverUser` prop 전달. `useAuth(initialUser)`로 hydration 시 `null`→`user` 전환 깜빡임 방지.
- **`skipInitialFetch` ref** — SSR prefetch 완료 시 `useAuth`의 `useEffect`가 `getUser(token)`을 중복 호출하지 않도록 `useRef(!!initialUser)`로 첫 effect skip.
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

## Docs·콘텐츠 페이지 SSR 패턴

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
- **shadcn `--overwrite` 플래그** — 기존 컴포넌트를 새 버전으로 덮어씀. button.tsx의 `asChild` prop 등 호환성 깨질 수 있음. 사용 후 `git diff` 확인 필수.
- **`--accent`는 text 색상으로 부적합** — light/dark 모두 `oklch(0.45)` 동일 명도. 테마 자동 적응 text에는 `text-foreground` 사용. 배경색(`bg-accent/10`, `bg-accent/20`)으로만 사용할 것.
- **Laravel API 응답 형식 불일치** — `Resource::collection()`은 `{data: [...]}`, 단일은 `{data: {...}}`. 인터페이스 정의 시 Network 탭으로 확인.
- **`.claude/settings.json` Stop hook에 `npm run build` 금지** — BUILD_ID 생성으로 dev 모드 이탈.
- **JS 청크 캐싱 (Cloudflare)** — `_next/static/*`이 `max-age=14400`. 개발 환경은 Cache Rule 바이패스.
- **OAuth 콜백 `?token=`** — middleware에서 `response.cookies.set("auth_token", token)` + `NextResponse.redirect`로 서버사이드 처리. 페이지 렌더링 전 완료되어 깜빡임 없음.
- **`--no-bin-links`** — Docker 볼륨 마운트 환경에서 npm 심볼릭 링크 생성 불가.
- **outline 버튼 light 모드 hover** — `hover:bg-muted hover:text-foreground`로 덮어쓸 것.
- **ThemeToggle SSR 깜빡임** — `useSyncExternalStore` + `opacity-0` invisible 버튼 패턴 사용 금지. SSR에서도 실제 버튼 렌더링.
- **컨테이너 재생성 후** — `docker compose stop` + `up -d` 후 `npm run build`로 타입 체크 확인.
- **CSS 트랜지션 사이드바 패턴** — 접기/펼치기 시 `{!collapsed && <nav>}` 조건부 렌더링은 width 트랜지션 중 텍스트 래핑으로 높이 깨짐 발생. 해결: nav에 `h-0 overflow-hidden` 적용, 자식 버튼에 `whitespace-nowrap overflow-hidden` 추가. shadcn Sheet의 `showCloseButton` 기본값이 `true` — 커스텀 닫기 버튼 사용 시 `showCloseButton={false}` 필수.
- **폼 버튼 순서 컨벤션** — 입력 폼에서 초기화 버튼은 검색 버튼 앞에 배치: `Input → 초기화(X) → 검색(Search)`. 검색 버튼이 disabled일 때도 초기화 버튼이 보이도록 조건부 렌더링 순서 준수.
- **`router.replace` + `<Link>` 동일 URL 충돌** — `router.replace("/embed")`와 `<Link href="/embed">`가 동시에 실행되면 URL이 변경되지 않음. 즉시 URL 변경이 필요하면 `router.replace` 대신 `window.history.replaceState()` 사용.
- **useCallback + setState stale closure** — 이벤트 핸들러에서 setState 후 동기 호출되는 useCallback은 이전 render의 state를 캡처. 해결: useRef로 최신 값 추적 → 핸들러에서 ref 먼저 업데이트 → 콜백은 ref 읽고 의존성에서 state 제거.
- **비동기 reload 전 `setState([])`로 stale guard** — 데이터 소스 변경(예: 회원 전환) 후 `loadData()` 호출 전에 `setData([])`로 즉시 초기화. 비동기 로드 완료 전 stale 데이터로 인한 false-positive 중복 체크 방지.
- **폴더 삭제 후 onFolderActionComplete 호출 금지** — onFolderChange(null)이 이미 folder=undefined로 올바르게 카테고리 재로드.
- **폴더 Select** — 두 Select(메인·이동) 스타일 동기화. `loadFolders()`는 `grouped` 응답 위해 userId 없이 호출. 상세: 루트 `AGENTS.md` 및 `[[frontend/core]]`.
- **폴더 이동** — 선택이동·전체이동 버튼은 `window.confirm()`으로 개수 고지. 이동할 폴더 Select는 현재 선택 폴더 disabled. API 응답 `{ moved, failed }`로 중복 실패 시에도 통계 표시 (`result.failed > 0` → `setError(result.message)`).
- **`addCategory()` folder 전파** — `folder` 파라미터를 `useCategories.addCategory()` → `createCategory()` → API까지 전달 필수. 누락 시 기본폴더로 생성됨.
- **`addCategory()` 에러 re-throw** — hook 내부에서 catch 후 `setError`만 호출하면 caller가 성공/실패를 구분할 수 없어 입력값이 항상 초기화됨. hook에서 `throw err`로 재전파 후 caller에서 try/catch로 감싸 성공 시에만 input 초기화.
- **`resetToDefault` selectedIds 누락** — `resetToDefault()` 호출 시 필터·검색어·페이지뿐 아니라 `setSelectedIds(new Set())`으로 체크박스도 초기화 필수.
- **`resetToDefault` 폴더 상태 누락** — `resetToDefault()`에서 `selectedFolder`·`selectedUserId`를 `null`로 초기화 필수. 미적용 시 폴더 select가 옵션에 없는 stale 값("테스트폴더" 등) 표시. `loadCategories()` 호출 시에도 folder·userId에 stale 값 대신 `undefined` 전달.
- **SSR page.tsx 파라미터 전파 누락** — `embed-page-inner.tsx` prop 추가 시 SSR `page.tsx`의 prefetch 호출에도 동일 파라미터 전달 필요.
- **커스텀 이벤트 다중 리스너 레이스 컨디션** — `resetEmbedPage` 등 동일 `CustomEvent`에 여러 컴포넌트가 리스닝 시 모든 핸들러가 동기 실행됨. 자식(FolderSection 등)의 핸들러는 부모 콜백(onFolderChange) 호출 금지, 로컬 UI 상태만 초기화. 부모 콜백은 stale closure로 올바른 `loadCategories`를 덮어씀.
- **SelectTrigger 기본 height**: `data-[size=default]:h-8` (32px). 인접 버튼 height 불일치 방지 위해 `h-8`로 통일 (`h-9` 사용 시 4px 차이).
- **Flex 내 truncate는 `min-w-0` 필수** — flex 아이템 기본 `min-width: auto`가 `truncate` CSS를 무력화. `SelectTrigger` 등 flex 레이아웃 내 truncation 필요 시 부모 컨테이너에 `min-w-0` 추가.
- **Playwright shadcn Select** — `browser_select_option`은 native `<select>` 전용. shadcn Select(role="combobox")는 `browser_run_code_unsafe` + `async (page) => {...}`로 조작. `window.fetch` monkey-patch로 API 호출 스택 추적 가능.

## 관련 문서

- 디자인 가이드: [`docs/UI_GUIDE.md`](../docs/UI_GUIDE.md)
- 아키텍처 결정 기록: [`docs/ADR.md`](../docs/ADR.md)
- 제품 요구사항: [`docs/PRD.md`](../docs/PRD.md)
