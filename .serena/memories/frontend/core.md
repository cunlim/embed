# Frontend Core — 프론트엔드 모듈

> 상세 내용은 `nextjs/AGENTS.md` 참조. 여기서는 핵심 invariant만 기록.

## 디자인 시스템

- **shadcn/ui** `base-nova` 스타일. 컴포넌트 추가: `docker exec cl_embed_nextjs npx shadcn@latest add <component>`
- **CSS 변수 text 색상**: `text-foreground`는 light(검정)/dark(white) 자동 적응. `text-accent`는 양쪽 모두 어두운 색상(0.45)이므로 text에 부적합, 배경(`bg-accent/10`, `bg-accent/20`)으로만 사용.

## 테스트

- **Vitest** + **React Testing Library** + **jsdom**
- **TDD 적용**: 새 훅, 유틸리티 함수, API 클라이언트 추가 시 테스트 먼저 작성
- `vitest` 바이너리 직접 실행 금지 — `--no-bin-links`로 `node_modules/.bin/vitest` 미생성. `npm test` 사용.

## SSR/CSR 핵심

- **`getToken()`은 SSR 시 `null`**: `typeof document === "undefined"` 체크. client component 내 인증 조건부 렌더링은 `serverHadToken` prop 사용.
- **서버 컴포넌트 인증 게이트**: `cookies()` → `getUser(token)` → `redirect()` — SSR 단계 인증 실패 시 HTTP 307만 반환.
- **Middleware 쿠키+리다이렉트**: OAuth 콜백 `?token=` → `middleware.ts` → `response.cookies.set()` + `NextResponse.redirect()`.

## 알려진 이슈

- CSS 트랜지션 사이드바: `h-0 overflow-hidden` + `whitespace-nowrap overflow-hidden` 패턴 사용
- shadcn Sheet: `showCloseButton={false}` 커스텀 닫기 버튼 사용 시 필수
- `router.replace` + `<Link>` 동일 URL 충돌 — `window.history.replaceState()` 사용
- 폴더 플레이스홀더: `__folder_placeholder__` → 모든 카테고리 쿼리에서 필터링
