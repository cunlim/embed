# nextjs/AGENTS.md

## 프로젝트 개요

AI 기반 다국어 카테고리 추천 시스템의 프론트엔드.
Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui (`base-nova` 스타일).

## 명령어

`docker exec cl_embed_nextjs npm run <command>` 패턴. 자주 사용: `dev`, `build`, `lint`, `test`, `test:watch`.
shadcn 컴포넌트 추가: `docker exec cl_embed_nextjs npx shadcn@latest add <component>`.

## 디자인 시스템

디자인 컨벤션은 [`docs/UI_GUIDE.md`](../docs/UI_GUIDE.md) 참조. 구현 변경 시 문서가 stale일 수 있으므로 실제 코드 상태를 우선한다.

## Next.js 16 주요 함정

> `node_modules/next/dist/docs/`의 공식 문서를 먼저 읽고 브레이킹 체인지를 숙지할 것.

1. **App Router만 사용** — `pages/` 디렉토리 사용 안 함
2. **기본값: Server Components** — 실시간 인터랙션이 필요한 곳만 `"use client"` 추가
3. **async 컴포넌트** — `getServerSideProps` / `getStaticProps` 없음
4. **Metadata API** — `<Head>` 대신 `export const metadata`
5. **fetch 캐싱** — 기본 비캐시. 캐싱 필요 시 명시적 `cache: "force-cache"`

## ESLint 주요 규칙

- **`react-hooks/set-state-in-effect`** — useEffect 내 동기적 setState 금지 (0-tolerance)
  - Mount 감지: `useSyncExternalStore(() => () => {}, () => true, () => false)` 사용
  - Data fetch: 훅이 mount 시 자동 로드 — effect에서 수동 호출 금지
- **`react-hooks/refs`** — `useRef`의 `.current` render 중 사용 금지. 콜백 ref는 `useEffect(() => { ref.current = callback })` 사용.
- **`useSearchParams`는 `<Suspense>` 경계 필수** — 빌드 시 오류 발생

## useEffect 무한 루프 방지

- **`useSearchParams()`가 새 객체 반환 시** (테스트 mock 등) effect 내 `setState`가 무한 루프 유발. `resetDoneRef` 패턴으로 1회만 실행하도록 guard 필요.
- **effect에서 부모 콜백 호출 금지** — `onKeywordSearch()`, `onFilterChange()` 등 부모 state를 변경하는 콜백을 effect에서 호출하면 `react-hooks/preserve-manual-memoization` 에러 발생. 로컬 상태만 리셋하고, 부모 콜백은 `EmbedPageInner`에서 직접 호출.
- **`resetKey` prop 패턴** — `refreshKey`(옵션 재조회)와 별도로 `resetKey`(상태 완전 초기화)를 분리. `resetKey` effect에서는 부모 콜백 없이 로컬 상태만 리셋 + 옵션 재조회.
- **`setLevelOptions` 자식 depth 보존** — `refreshKey`/`resetKey` effect에서 `setLevelOptions([opts])` 호출 시 자식 depth 옵션이 삭제됨. `setLevelOptions((prev) => prev.length > 1 ? [opts, ...prev.slice(1)] : [opts])`로 함수형 업데이트하여 보존.
- **`resetKey` 초기 옵션 즉시 설정** — `setLevelOptions([])`로 초기화하면 fetch 완료 전까지 "사용 가능한 카테고리가 없습니다" 플래시 발생. `initialLevelOptions`가 있으면 즉시 설정 후 fetch로 갱신.
- **모달 자동 open 제거 시 `onSelectLeafPath` 확인** — `CategoryHierarchy`의 `onSelectCategory`만 제거하면 `EmbedPageInner`의 `onSelectLeafPath` 콜백이 `setModalCategoryId`를 호출하여 모달이 열림. 양쪽 모두 제거 필요.

## SSR 패턴

- URL을 state의 source of truth로 — `useSearchParams()` 변경 감지 → URL→state 단방향 싱크
- `useCallback` 내 stale state 방지를 위해 ref로 최신값 읽기 (`searchLangRef`, `perPageRef` 등)
- 컴포넌트 props 추가 시 `npx tsc --noEmit` 확인 (npm test는 모킹으로 타입 체크 우회)

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

- **Laravel API 응답 형식 불일치** — `Resource::collection()`은 `{data: [...]}`, 단일은 `{data: {...}}`. 인터페이스 정의 시 Network 탭으로 확인.
- **`.claude/settings.json` Stop hook에 `npm run build` 금지** — BUILD_ID 생성으로 dev 모드 이탈.
- **JS 청크 캐싱 (Cloudflare)** — `_next/static/*`이 `max-age=14400`. 개발 환경은 Cache Rule 바이패스.
- **OAuth 콜백 `?token=` 파라미터** — `/login`에서 `searchParams.get("token")`으로 localStorage 저장 필수.
- **`--no-bin-links`** — Docker 볼륨 마운트 환경에서 npm 심볼릭 링크 생성 불가.
- **outline 버튼 light 모드 hover** — `hover:bg-muted hover:text-foreground`로 덮어쓸 것.
- **인증 가드 패턴** — `const authorized = isAdmin(user)`로 직접 도출 (effect 금지)
- **컨테이너 재생성 후** — `docker compose stop` + `up -d` 후 `npm run build`로 타입 체크 확인.

## 관련 문서

- 디자인 가이드: [`docs/UI_GUIDE.md`](../docs/UI_GUIDE.md)
- 전체 아키텍처: [`docs/ADR.md`](../docs/ADR.md)
- 제품 요구사항: [`docs/PRD.md`](../docs/PRD.md)
