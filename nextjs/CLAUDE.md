# nextjs/CLAUDE.md

## AGENTS.md (필독)

이 프로젝트의 [`AGENTS.md`](./AGENTS.md)는 Next.js 16의 브레이킹 체인지에 대해 설명합니다.
코드 작성 전 반드시 `node_modules/next/dist/docs/`의 관련 가이드를 확인하세요.

## 프로젝트 개요

AI 기반 다국어 카테고리 추천 시스템의 프론트엔드입니다.
Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui (`base-nova` 스타일) 기반.

## 명령어

`docker exec cl_embed_nextjs npm run <command>` 패턴. 자주 사용: `dev`, `build`, `lint`, `test`, `test:watch`.
shadcn 컴포넌트 추가: `docker exec cl_embed_nextjs npx shadcn@latest add <component>`.

## 디자인 시스템

디자인 컨벤션은 [`docs/UI_GUIDE.md`](../docs/UI_GUIDE.md) 참조. 구현 변경 시 문서가 stale일 수 있으므로 실제 코드 상태를 우선한다.

## 코드 컨벤션

> **Next.js 16 주요 함정** — [AGENTS.md](./AGENTS.md) 필독. App Router 전용, Server Components 기본, fetch 캐싱 없음 등 브레이킹 체인지 전체 목록 참조.

### React / Next.js
- **Server Components 기본**: 실시간 인터랙션(모달)이 필요한 구간만 `"use client"` 지시문 추가
- **App Router**: `app/` 디렉토리 내 페이지 라우팅
- **TypeScript strict**: 모든 props, 함수 반환값에 명시적 타입 선언
- **`@/*` import alias**: `@/components/ui/button`, `@/lib/utils` 등

## ESLint 주요 규칙

- **`@next/next/no-html-link-for-pages`** — 내부 페이지 이동 시 `<a href="/">` 금지, `<Link href="/">` 사용.
- **`react-hooks/set-state-in-effect`** — useEffect 내 동기적 setState 호출 금지 (0-tolerance). 해결 패턴:
  - **Mount 감지**: `useState`+`useEffect` 대신 `useSyncExternalStore(() => () => {}, () => true, () => false)` 사용
  - **파생 상태**: effect에서 `setState` 대신 기존 state에서 직접 도출 (예: `const authorized = user ? isAdmin(user.id) : false`)
  - **Data fetch**: `useCategories`/`useAuth` 훅이 mount 시 자동 로드 — 컴포넌트 effect에서 수동 호출 금지
- **`react-hooks/refs`** — `useRef`의 `.current`를 render 중에 쓰기 금지. 콜백 ref 동기화는 `useEffect(() => { ref.current = callback })` 사용 (의존성 배열 없음 — 매 렌더링 후 갱신이 의도된 패턴).
- **모달 닫힘 애니메이션 중 prop 변화로 인한 깜빡임 방지** — `react-hooks/refs` + `set-state-in-effect` 제약으로 인해 모달 내부에서 ref/effect로 prop을 안정화할 수 없다. 부모 컴포넌트에서 별도 `useState`로 값을 캡처하고, 모달을 열 때만 `setState`로 갱신하며 닫을 때는 그대로 두는 패턴을 사용한다.
- **`@typescript-eslint/no-unused-vars`** — 미사용 import는 오류. 작업 완료 후 확인할 것.

## Tailwind v4

- **`space-y-*`는 자식이 inline이면 무시됨** — `<span>`은 `display: inline`이라 `space-y-*`의 `margin-bottom`이 렌더링되지 않음. `<span>`에 `inline-block` 추가해야 vertical margin 적용됨. `space-y-*`와 `mb-*` 혼합 금지.
- **`space-y-*` 검증은 Playwright `browser_evaluate`로** — `getComputedStyle()`만 보면 inline 요소의 margin이 있는 것처럼 표시되므로, `getBoundingClientRect()`로 자식 간 실제 gap을 측정해야 함.

## Modal/Dialog 반응형

- **Dialog 콘텐츠 컨테이너에 `min-w-0` 필수** — Dialog의 `max-w-[calc(100%-2rem)]`이 grid item을 제약해도, 내부 `space-y-*`/`flex` 컨테이너는 `min-width: auto`(기본값)로 인해 제약을 무시하고 확장된다. 최상위 콘텐츠 div와 중간 flex 컨테이너에 `min-w-0`을 명시해야 max-width가 하위 요소까지 전파된다.
- **flex row의 고정 요소에 `shrink-0`** — 점수·뱃지·아이콘 등 고정 너비가 의도된 flex 자식은 `flex-shrink: 1`(기본값)에 의해 공간 부족 시 축소된다. `truncate` 텍스트 영역에 최대 공간을 주려면 다른 모든 flex 자식에 `shrink-0`을 명시한다.
- **긴 텍스트 라벨도 `truncate` 적용** — `<p>` 라벨이 카테고리명 등으로 길어질 수 있으면 `min-w-0 truncate`를 추가한다.

## Dark 모드

- **card/popover 배경 chroma 최소화** — `oklch(L 0.003 H)`, chroma 0.005 이하.
- **card-background lightness 차이** — 0.07 이상 확보.
- CSS 변수는 `app/globals.css`의 `.dark` 셀렉터에서 정의.

## SSR (Server Components)

- **SSR prefetch 시 CSR과 동일 파라미터** — `parseEmbedParams()`로 URL 파라미터 SSR/CSR 공통 추출.
- **URL 파라미터 갱신 시 기존 파라미터 보존** — `new URLSearchParams(searchParams.toString())`로 시작.
- **컴포넌트 props 추가 시 `npx tsc --noEmit` 확인** — `npm test`는 모킹으로 타입 체크 우회.
- **URL을 state의 source of truth로** — `useSearchParams()` 변경 감지 → URL과 state 불일치 시 동기화. 브라우저 뒤로/앞으로 가기 대응은 useEffect로 URL→state 단방향 싱크.
- **useCallback 내 상태 대신 ref 사용** — `handleSearch`처럼 URL 동기화 effect에서 호출되는 콜백은 closure의 stale state 문제를 피하기 위해 `searchLangRef` 등 ref로 최신값을 읽는다 (`perPageRef`, `filterRef`와 동일 패턴).
- **useCallback + `useState<Set<T>>` 의존성 누락** — `useCallback` 내부에서 Set state를 읽으면 의존성 배열에 반드시 포함할 것. `setCheckedSteps(prev => new Set(prev))`는 참조 변경으로 정상 작동하지만, 콜백이 stale Set을 캡처하면 체크박스 변경이 실행 큐에 반영되지 않는다.

## 테스트

**CRITICAL: 프론트엔드도 TDD를 적용한다.** 새 훅, 유틸리티 함수, API 클라이언트 추가 시 테스트를 먼저 작성할 것.

Vitest + React Testing Library + jsdom 구성 완료. `vitest.config.ts`에서 `@/*` alias, jsdom 환경, CSS 지원 설정됨.

테스트 디렉토리 규칙:
- `lib/__tests__/*.test.ts` — 순수 함수, API 클라이언트
- `hooks/__tests__/*.test.ts` — 커스텀 훅 (@testing-library/react의 renderHook 사용)
- API 호출을 모킹할 때는 `vi.mock("@/lib/api")`로 모듈 전체를 모킹
- **shadcn Select는 `<select>`가 아님** — `role="combobox"` 기반 커스텀 컴포넌트. Playwright에서 `selectOption()` 대신 옵션 클릭 사용: `page.getByRole('option', { name: '...' }).click()`
- **shadcn Select 초기화용 항목 누락** — native `<select>`의 `<option value="">`과 달리 shadcn Select의 `placeholder`는 드롭다운에 표시되지 않는다. 선택 초기화가 필요하면 `<SelectContent>`에 `<SelectItem value="">` 항목을 명시적으로 추가할 것.
- **`onValueChange` 타입: `string | null`** — base-ui Select의 `onValueChange` 콜백은 `string | null`을 전달하므로, `string` 파라미터를 받는 핸들러에 전달 시 `value ?? ""`로 null 처리할 것.
- **`CardTitle`은 `<div>` 요소** — `role="heading"`이 없으므로 테스트에서 `getByRole('heading', ...)`으로 찾을 수 없다. `getByText()` / `getAllByText()` 사용할 것.

## 알려진 이슈

> 인프라·Docker·CI/CD 관련 이슈는 루트 [`CLAUDE.md`](../CLAUDE.md)의 "알려진 이슈" 섹션도 함께 참조할 것.

- **Laravel API 응답 형식과 프론트엔드 타입 불일치** — Laravel `Resource::collection()`은 `{data: [...]}`, 단일 `Resource`는 `{data: {...}}` 형식으로 응답한다. TypeScript 인터페이스 정의 시 실제 응답 형식을 curl이나 브라우저 Network 탭으로 확인하고 가정하지 말 것.
- **Next.js HMR 에러 로그** — `embed_nextjs_error.log`의 "Connection refused"는 dev 서버 재시작 시 정상 발생. 무시.
- **`next dev`(Turbopack)도 BUILD_ID 생성** — `.next/production` 센티널 파일로 모드 감지 (`npm run build && touch .next/production`). `next start` 프로세스가 보이면 production mode.
- **`.claude/settings.json` Stop hook에 `npm run build` 금지** — production build가 BUILD_ID를 생성해 dev 모드 이탈을 유발한다. 타입 체크만 필요하면 `npx tsc --noEmit`을 대신 사용한다.
- **JS 청크 캐싱 (Cloudflare)** — Cloudflare가 `_next/static/*` 응답을 `max-age=14400`으로 덮어써 구버전 코드가 실행될 수 있다. 개발 환경에서는 Cloudflare Cache Rule로 전체 바이패스 설정.
- **OAuth 콜백 `?token=` 파라미터 처리 필수** — `/login` 페이지에서 `searchParams.get("token")`으로 토큰을 읽고 `setToken()`으로 localStorage에 저장해야 한다. 저장하지 않으면 OAuth 로그인이 완료되어도 토큰이 폐기된다.
- **`--no-bin-links`** — Docker 볼륨 마운트 환경에서 npm 패키지 설치 시 심볼릭 링크 생성 불가로 `--no-bin-links` 필요.
- **lucide-react 브랜드 아이콘 없음** — Google, GitHub, Naver 등 OAuth 브랜드 아이콘은 lucide-react에 없다. 인라인 SVG 사용.
- **outline 버튼 light 모드 hover 텍스트 invisible** — `variant="outline"`은 `hover:text-accent-foreground`를 포함하는데, light 배경에서 accent-foreground는 흰색 계열이므로 텍스트가 보이지 않게 된다. `hover:bg-muted hover:text-foreground`로 덮어쓸 것.
- **shadcn form 컴포넌트 수동 생성** — `npx shadcn add form`이 조용히 실패할 수 있음. 필요 시 `components/ui/form.tsx`를 수동 작성 (react-hook-form + Controller 통합).
- **`useSearchParams`는 `<Suspense>` 경계 필수** — `useSearchParams()`를 사용하는 페이지는 반드시 `<Suspense>`로 감싸야 한다. 빌드 시 "useSearchParams() should be wrapped in a suspense boundary" 오류 발생. 패턴: `export default function Page() { return <Suspense><InnerForm /></Suspense>; }` — 내부 컴포넌트에서 `useSearchParams()` 사용.
- **인증 가드 패턴 (admin)** — `useAuth()`의 `isLoading`으로 사용자 로딩 완료까지 대기. `authorized`는 별도 state 대신 `const authorized = isAdmin(user)`로 user에서 직접 도출할 것 (`setAuthorized(true)` effect 금지). 비로그인 → `router.replace("/login?redirect=/admin")`. 로그인 + 비관리자 → `router.back()`.
- **`isAdmin(user)` / `isSuperAdmin(user)` — `@/lib/utils`** — user 객체(`{role?: string}`)의 role로 권한 체크. `isAdmin`은 admin+superadmin, `isSuperAdmin`은 superadmin만. 시그니처 변경 시 `tsc --noEmit`으로 모든 호출자를 찾아 갱신할 것.
- **`vitest` 바이너리 직접 실행 금지** — `--no-bin-links`로 인해 `node_modules/.bin/vitest` 미생성. `npm test` 또는 `node node_modules/vitest/vitest.mjs run` 사용.
- **컨테이너 재생성 후 타입 재평가** — `docker compose stop` + `up -d`로 컨테이너 재생성 시 npm 의존성 타입이 재평가되어 이전에 통과하던 TypeScript 체크가 실패할 수 있다. 재생성 후 반드시 `npm run build`로 타입 체크를 확인할 것.
- **SSR prefetch 파라미터 일치 필수** — `page.tsx`의 `getCategories()`·`recommend()` 호출 인자(token, filter, keyword, page, perPage)가 CSR과 정확히 일치해야 불일치가 발생하지 않는다.

## 관련 문서

- 디자인 가이드: [`docs/UI_GUIDE.md`](../docs/UI_GUIDE.md)
- 전체 아키텍처: [`docs/ADR.md`](../docs/ADR.md)
- 제품 요구사항: [`docs/PRD.md`](../docs/PRD.md)
- 프로젝트 루트: [`/CLAUDE.md`](../CLAUDE.md)
- 백엔드 가이드라인: [`laravel/CLAUDE.md`](../laravel/CLAUDE.md)
