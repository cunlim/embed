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

5개 페이지 구성은 [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)를 참조. 요약: `/`(랜딩), `/login`(로그인), `/embed`(기술 시연), `/docs`(문서), `/admin`(관리자·인증 필수).

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

### 상태 관리
- **서버 상태**: RSC에서 직접 DB 쿼리 (Laravel API 호출)
- **클라이언트 상태**: React hooks (useState, useEffect)
- **비회원**: `LocalStorage` + `session_id` 기반
- **회원**: Laravel Sanctum API Token → `User ID` 종속

## 정적 문서 서빙

- **`public/content/*.md`** — 마크다운 문서를 `public/content/`에 복사해 `fetch('/content/{slug}.md')`로 클라이언트에서 접근.
- **react-markdown** — ^10.1.0 이미 설치됨. 마크다운 렌더링 시 커스텀 regex 대신 사용.

## ESLint 주요 규칙

- **`@next/next/no-html-link-for-pages`** — 내부 페이지 이동 시 `<a href="/">` 금지, `<Link href="/">` 사용.
- **`react-hooks/set-state-in-effect`** — useEffect 내 동기적 setState 호출 금지. mounted 패턴은 기존 코드베이스에서 사용 중이나 신규 코드에서는 피할 것.
- **`@typescript-eslint/no-unused-vars`** — 미사용 import는 오류. 작업 완료 후 확인할 것.

## 테스트

아직 자동화된 테스트 프레임워크는 미설정 상태입니다. (추후 Vitest + React Testing Library 도입 예정)

현재는 브라우저에서 수동으로 확인합니다:

```bash
# 프로덕션 배포 후
open https://embed.cunlim.dev       # 랜딩 페이지
open https://embed.cunlim.dev/embed  # 기술 시연 페이지
```

## 알려진 이슈

- **Next.js HMR 에러 로그** — `embed_nextjs_error.log`의 "Connection refused"는 dev 서버 재시작 시 정상 발생. 무시.
- **`--no-bin-links`** — Docker 볼륨 마운트 환경에서 npm 패키지 설치 시 심볼릭 링크 생성 불가로 `--no-bin-links` 필요.
- **Next.js 16 브레이킹 체인지** — `node_modules/next/dist/docs/` 확인 필수. 코드 작성 전 [`AGENTS.md`](./AGENTS.md) 참조.
- **SSR `window` 참조 오류** — `pusher-js`, `laravel-echo` 등 브라우저 전용 라이브러리는 `import()` 동적 import로 SSR prerender 오류를 방지할 것. 정적 import 시 `ReferenceError: window is not defined`.
- **`laravel-echo` 제네릭 타입** — 최신 `laravel-echo`의 Echo 클래스는 `Echo<T extends keyof Broadcaster>` 제네릭을 요구한다. Reverb 연결이면 `Echo<"reverb">` 타입 사용.
- **lucide-react 브랜드 아이콘 없음** — Google, GitHub, Naver 등 OAuth 브랜드 아이콘은 lucide-react에 없다. 인라인 SVG 사용.
- **shadcn form 컴포넌트 수동 생성** — `npx shadcn add form`이 조용히 실패할 수 있음. 필요 시 `components/ui/form.tsx`를 수동 작성 (react-hook-form + Controller 통합).

## 관련 문서

- 디자인 가이드: [`docs/UI_GUIDE.md`](../docs/UI_GUIDE.md)
- 전체 아키텍처: [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
- 제품 요구사항: [`docs/PRD.md`](../docs/PRD.md)
- 아키텍처 결정: [`docs/ADR.md`](../docs/ADR.md)
- 프로젝트 루트: [`/CLAUDE.md`](../CLAUDE.md)
- 백엔드 가이드라인: [`laravel/CLAUDE.md`](../laravel/CLAUDE.md)
