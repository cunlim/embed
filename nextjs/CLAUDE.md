# nextjs/CLAUDE.md

## AGENTS.md (필독)

이 프로젝트의 [`AGENTS.md`](./AGENTS.md)는 Next.js 16의 브레이킹 체인지에 대해 설명합니다.
코드 작성 전 반드시 `node_modules/next/dist/docs/`의 관련 가이드를 확인하세요.

## 프로젝트 개요

AI 기반 다국어 카테고리 추천 시스템의 프론트엔드입니다.
Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui (`base-nova` 스타일) 기반.

## 디렉토리 구조

```
nextjs/
├── app/                    # App Router 페이지
│   ├── layout.tsx          # 루트 레이아웃 (폰트, 테마 프로바이더)
│   ├── page.tsx            # / 랜딩 페이지
│   └── globals.css         # Tailwind + CSS 변수
├── components/
│   ├── site-header.tsx    # 공통 헤더 (로고→"/" 링크, ThemeToggle 우측 고정, badge/children prop)
│   ├── social-login.tsx   # 소셜 로그인 버튼 그룹 (페이지/Modal 재사용 가능)
│   ├── ui/                 # shadcn/ui 컴포넌트 (자동 생성)
│   ├── theme-provider.tsx  # next-themes Provider
│   └── theme-toggle.tsx    # 화이트/다크 모드 토글
├── hooks/                  # 커스텀 훅
├── lib/
│   └── utils.ts            # cn() 헬퍼 (classname 병합)
├── components.json         # shadcn/ui 설정 (base-nova, rsc, tsx)
├── next.config.ts          # Next.js 설정 (allowedDevOrigins)
├── tsconfig.json           # TypeScript strict, bundler resolution, @/* alias
└── public/                 # 정적 파일
```

## 컨테이너 정보

- **컨테이너명:** `cl_embed_nextjs`
- **내부 포트:** 3000
- WATCHPACK_POLLING 적용 (Docker 볼륨 핫리로드)

## 주요 패키지

| 패키지 | 버전 | 용도 |
|--------|------|------|
| next | 16.2.4 | App Router |
| react / react-dom | 19.2.4 | RSC + Client Components |
| typescript | ^5 | strict 모드 |
| tailwindcss | ^4 | CSS 프레임워크 |
| shadcn | ^4.7.0 | UI 컴포넌트 (base-nova 스타일) |
| next-themes | ^0.4.6 | 화이트/다크 모드 |
| lucide-react | ^1.14.0 | 아이콘 (이모지 금지) |
| class-variance-authority | ^0.7.1 | 컴포넌트 변형 |
| tailwind-merge | ^3.5.0 | 클래스 충돌 방지 |
| vitest | ^4 | 단위/훅/컴포넌트 테스트 |
| @testing-library/react | ^16 | React 컴포넌트 테스트 |
| @testing-library/jest-dom | ^6 | DOM 매처 (toBeInTheDocument 등) |
| jsdom | ^29 | 브라우저 환경 에뮬레이션 |

## 명령어

모든 명령어는 `cl_embed_nextjs` 컨테이너 대상으로 `docker exec`를 통해 실행합니다.
컨테이너 내부에서 npm 실행 시 `--no-bin-links` 플래그가 필요할 수 있습니다.

```bash
# 개발 서버
docker exec cl_embed_nextjs npm run dev

# 프로덕션 빌드
docker exec cl_embed_nextjs npm run build

# ESLint
docker exec cl_embed_nextjs npm run lint

# 테스트 (Vitest)
docker exec cl_embed_nextjs npm test
docker exec cl_embed_nextjs npm run test:watch
```

### shadcn/ui 컴포넌트 추가

```bash
# 컴포넌트 추가
docker exec cl_embed_nextjs npx shadcn@latest add button
docker exec cl_embed_nextjs npx shadcn@latest add card
docker exec cl_embed_nextjs npx shadcn@latest add dialog

# shadcn MCP 서버로 사용 가능한 컴포넌트 검색
# (search_components 도구 사용)
```

## 페이지 구성

5개 페이지 구성은 [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)를 참조. 요약: `/`(랜딩), `/login`(로그인), `/embed`(기술 시연·인증 필수), `/docs`(문서), `/admin`(관리자·인증 필수).

## 디자인 시스템

모든 UI 작업은 `ui-ux-pro-max:ui-ux-pro-max` plugin을 활성화하여 수행한다.
디자인 상세는 [`docs/UI_GUIDE.md`](../docs/UI_GUIDE.md)를 엄격히 준수한다.

핵심 제약:
- **색상**: CSS 변수만 사용 (oklch 색 공간). raw hex 금지.
- **아이콘**: lucide-react만 사용. 이모지 금지.
- **반응형**: mobile-first (375px → 768px → 1280px+)
- **다크 모드**: `next-themes` class 전략. light/dark 모두 지원 필수.
- **애니메이션**: transform/opacity만 사용. `prefers-reduced-motion` 대응.
- **shadcn/ui**: `base-nova` 스타일, RSC 호환, TypeScript.

## 코드 컨벤션

> **Next.js 16 주요 함정** — [AGENTS.md](./AGENTS.md) 전체 목록을 함께 참고할 것.
> 1. **App Router만 사용** — `pages/` 디렉토리 기반 Pages Router 금지. 모든 페이지는 `app/` 내 `page.tsx`.
> 2. **기본값 Server Components** — `"use client"` 없으면 `useState`, `useEffect`, `onClick` 사용 불가.
> 3. **fetch 캐싱 안 함** — Next.js 16은 `fetch`를 기본적으로 캐시하지 않는다. 필요 시 `cache: "force-cache"` 명시.

### React / Next.js
- **Server Components 기본**: 실시간 인터랙션(WebSocket, 모달)이 필요한 구간만 `"use client"` 지시문 추가
- **App Router**: `app/` 디렉토리 내 페이지 라우팅
- **TypeScript strict**: 모든 props, 함수 반환값에 명시적 타입 선언
- **`@/*` import alias**: `@/components/ui/button`, `@/lib/utils` 등

### Tailwind CSS v4
- shadcn/ui의 `base-nova` 스타일 CSS 변수 사용
- `cn()` 헬퍼 (`clsx` + `tailwind-merge`)로 클래스 병합
- 반응형: `sm:` (640px+), `md:` (768px+), `lg:` (1024px+), `xl:` (1280px+)
- **플러그인은 CSS `@plugin` 지시문** — `tailwind.config.js` 불필요. 예: `@plugin "@tailwindcss/typography";`

### 상태 관리
- **서버 상태**: RSC에서 직접 DB 쿼리 (Laravel API 호출)
- **클라이언트 상태**: React hooks (useState, useEffect)
- **비회원**: `LocalStorage` + `session_id` 기반
- **회원**: Laravel Sanctum API Token → `User ID` 종속

## 정적 문서 서빙

- **`../docs:/app/public/content:ro` bind mount** — `docker-compose.yml`에서 `docs/`를 Next.js `public/content/`에 직접 마운트. 복제 없이 항상 최신 문서 서빙.
- **react-markdown** — ^10.1.0 이미 설치됨. 마크다운 렌더링 시 커스텀 regex 대신 사용.
- **`@tailwindcss/typography`** — `prose prose-sm dark:prose-invert max-w-none` 클래스로 headings, code, table 등 대부분 스타일링 처리. 외부 링크 `target="_blank"` 등 필요한 부분만 `components` prop으로 오버라이드.

## ESLint 주요 규칙

- **`@next/next/no-html-link-for-pages`** — 내부 페이지 이동 시 `<a href="/">` 금지, `<Link href="/">` 사용.
- **`react-hooks/set-state-in-effect`** — useEffect 내 동기적 setState 호출 금지. mounted 패턴은 기존 코드베이스에서 사용 중이나 신규 코드에서는 피할 것.
- **`@typescript-eslint/no-unused-vars`** — 미사용 import는 오류. 작업 완료 후 확인할 것.

## 테스트

**CRITICAL: 프론트엔드도 TDD를 적용한다.** 새 훅, 유틸리티 함수, API 클라이언트 추가 시 테스트를 먼저 작성할 것.

Vitest + React Testing Library + jsdom 구성 완료. `vitest.config.ts`에서 `@/*` alias, jsdom 환경, CSS 지원 설정됨.

테스트 디렉토리 규칙:
- `lib/__tests__/*.test.ts` — 순수 함수, API 클라이언트
- `hooks/__tests__/*.test.ts` — 커스텀 훅 (@testing-library/react의 renderHook 사용)
- API 호출을 모킹할 때는 `vi.mock("@/lib/api")`로 모듈 전체를 모킹

## 알려진 이슈

- **Next.js HMR 에러 로그** — `embed_nextjs_error.log`의 "Connection refused"는 dev 서버 재시작 시 정상 발생. 무시.
- **`next dev`(Turbopack)도 BUILD_ID 생성** — Dockerfile CMD가 `.next/BUILD_ID`로 모드를 감지하면 dev 서버 실행만으로도 다음 재시작 시 production 모드로 전환된다. `.next/production` 센티널 파일을 대신 사용한다 (CI/CD 배포 시 `npm run build && touch .next/production`으로 생성). **감지:** `docker exec cl_embed_nextjs ps aux | grep "next start"` — `next start`가 보이면 production 모드. **복구:** `docker compose stop cl_embed_nextjs && docker exec $(docker ps -a --filter "name=cl_embed_nextjs$" --format "{{.ID}}" | head -1) rm -f /app/.next/BUILD_ID 2>/dev/null; docker compose -f /var/app/www/cl_embed/docker/docker-compose.yml up -d cl_embed_nextjs`
- **`.claude/settings.json` Stop hook에 `npm run build` 금지** — production build가 BUILD_ID를 생성해 dev 모드 이탈을 유발한다. 타입 체크만 필요하면 `npx tsc --noEmit`을 대신 사용한다.
- **브라우저 JS 청크 캐싱** — Turbopack HMR이 변경을 감지해 재컴파일해도, 브라우저가 이전 청크를 캐싱해 구버전 코드가 실행될 수 있음. 하드 리프레시(Ctrl+Shift+R)나 시크릿 창으로 확인할 것. Playwright 테스트 시에도 항상 `browser.newContext()`로 신규 컨텍스트 사용.
- **OAuth 콜백 `?token=` 파라미터 처리 필수** — `/login` 페이지에서 `searchParams.get("token")`으로 토큰을 읽고 `setToken()`으로 localStorage에 저장해야 한다. 저장하지 않으면 OAuth 로그인이 완료되어도 토큰이 폐기된다.
- **`--no-bin-links`** — Docker 볼륨 마운트 환경에서 npm 패키지 설치 시 심볼릭 링크 생성 불가로 `--no-bin-links` 필요.
- **Next.js 16 브레이킹 체인지** — `node_modules/next/dist/docs/` 확인 필수. 코드 작성 전 [`AGENTS.md`](./AGENTS.md) 참조.
- **SSR `window` 참조 오류** — `pusher-js`, `laravel-echo` 등 브라우저 전용 라이브러리는 `import()` 동적 import로 SSR prerender 오류를 방지할 것. 정적 import 시 `ReferenceError: window is not defined`.
- **`laravel-echo` 제네릭 타입** — 최신 `laravel-echo`의 Echo 클래스는 `Echo<T extends keyof Broadcaster>` 제네릭을 요구한다. Reverb 연결이면 `Echo<"reverb">` 타입 사용.
- **`NEXT_PUBLIC_REVERB_APP_KEY` 불일치** — `.env.local`의 키가 Laravel `.env`의 `REVERB_APP_KEY`와 다르면 WebSocket 핸드셰이크가 조용히 실패한다. 반드시 동일한 키를 사용할 것.
- **Broadcast 이벤트 페이로드** — Laravel `ShouldBroadcast` 이벤트의 public 프로퍼티만 클라이언트에 전송된다. `progressPercent` 같은 계산값은 프론트엔드 인터페이스에 포함하지 말고 소비처에서 직접 계산할 것.
- **`window.Pusher` 타입 선언** — `pusher-js`가 요구하는 `window.Pusher` 할당은 `as never as`로 우회하지 말고 `global.d.ts`에 `interface Window { Pusher: ... }`로 정식 선언할 것.
- **`createEcho()` 에러 핸들링** — 동적 import 실패나 Echo 생성자 예외에 대비해 `.catch()` 핸들러를 반드시 추가할 것. 미처리 시 영원히 `null` 상태로 남는다.
- **lucide-react 브랜드 아이콘 없음** — Google, GitHub, Naver 등 OAuth 브랜드 아이콘은 lucide-react에 없다. 인라인 SVG 사용.
- **outline 버튼 light 모드 hover 텍스트 invisible** — `variant="outline"`은 `hover:text-accent-foreground`를 포함하는데, light 배경에서 accent-foreground는 흰색 계열이므로 텍스트가 보이지 않게 된다. `hover:bg-muted hover:text-foreground`로 덮어쓸 것.
- **shadcn form 컴포넌트 수동 생성** — `npx shadcn add form`이 조용히 실패할 수 있음. 필요 시 `components/ui/form.tsx`를 수동 작성 (react-hook-form + Controller 통합).
- **`useSearchParams`는 `<Suspense>` 경계 필수** — `useSearchParams()`를 사용하는 페이지는 반드시 `<Suspense>`로 감싸야 한다. 빌드 시 "useSearchParams() should be wrapped in a suspense boundary" 오류 발생. 패턴: `export default function Page() { return <Suspense><InnerForm /></Suspense>; }` — 내부 컴포넌트에서 `useSearchParams()` 사용.
- **인증 가드 패턴 (admin)** — `useAuth()`의 `isLoading`으로 사용자 로딩 완료까지 대기. `authorized` 상태 플래그로 권한 확인 전까지 `return null`하여 admin 내용이 전혀 렌더링되지 않게 함. 관리자는 `id === 3`만 허용 (`app/admin/page.tsx`). 비로그인 → `router.replace("/login?redirect=/admin")`. 로그인 + 비관리자 → `router.back()`.
- **`vitest` 바이너리 직접 실행** — `--no-bin-links`로 인해 `node_modules/.bin/vitest`가 생성되지 않음. `package.json` 스크립트는 `node node_modules/vitest/vitest.mjs run`으로 실행. `npx vitest`도 동작하지 않으니 주의.
- **훅 메서드 간 호출 시 이중 상태 업데이트** — `addCategory` 내부에서 `loadCategories()`를 호출하면 `setIsLoading(true)`가 이중 호출되어 불필요한 렌더링 발생. 대신 API 함수(`getCategories(token)`)를 직접 호출하고 `setCategories(data.data)`로 상태를 직접 설정할 것.
- **`renderHook` + `act()` 중간 상태 테스트 불가** — pending Promise로 `isLoading`의 중간 true 상태를 검증하려는 테스트는 `act()`가 Promise 완료까지 대기하여 항상 false가 반환됨. `await act(async () => { await result.current.method(); })` 패턴으로 최종 상태만 검증할 것. 중간 상태 검증이 필요하면 deferred promise 대신 `waitFor` 사용.
- **컨테이너 재생성 후 타입 재평가** — `docker compose stop` + `up -d`로 컨테이너 재생성 시 npm 의존성 타입이 재평가되어 이전에 통과하던 TypeScript 체크가 실패할 수 있다 (예: `dialog.tsx`의 `size="icon-sm"`, `pusher-js` ↔ `@types/pusher-js` 버전 불일치). 재생성 후 반드시 `npm run build`로 타입 체크를 확인할 것.

- **AppHeader 공통 헤더** — `components/app-header.tsx`가 루트 레이아웃에 배치되어 모든 페이지에서 일관된 헤더 제공. `usePathname()`으로 `/admin` 경로 감지해 badge="admin" 자동 적용. `AuthButtons` 포함. 개별 페이지에서 `<SiteHeader>` 중복 사용 금지.
- **`useAuth()` 자동 사용자 로드** — 훅이 마운트 시 localStorage 토큰을 읽어 `GET /api/auth/user`를 자동 호출. `user` state가 null에서 시작해 API 응답 후 채워짐. `isLoading`으로 로딩 상태 확인 가능.
- **`getUser()` 응답 envelope** — `/api/auth/user`는 `{data: {id, name, email, created_at}}` 형식. `lib/api.ts`의 `getUser()`에서 `res.data`로 추출 필요. 로그인/회원가입 응답과 동일한 패턴.

## 관련 문서

- 디자인 가이드: [`docs/UI_GUIDE.md`](../docs/UI_GUIDE.md)
- 전체 아키텍처: [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
- 제품 요구사항: [`docs/PRD.md`](../docs/PRD.md)
- 아키텍처 결정: [`docs/ADR.md`](../docs/ADR.md)
- 프로젝트 루트: [`/CLAUDE.md`](../CLAUDE.md)
- 백엔드 가이드라인: [`laravel/CLAUDE.md`](../laravel/CLAUDE.md)
