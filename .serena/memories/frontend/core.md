# Frontend Core — 프론트엔드 모듈

> 상세 내용은 `nextjs/AGENTS.md` 참조. 여기서는 핵심 invariant만 기록.

## 디자인 시스템

- **shadcn/ui** `base-nova` 스타일. 컴포넌트 추가: `docker exec cl_embed_nextjs npx shadcn@latest add <component>`
- **CSS 변수 text 색상**: `text-foreground`는 light(검정)/dark(white) 자동 적응. `text-accent`는 양쪽 모두 어두운 색상(0.45)이므로 text에 부적합, 배경(`bg-accent/10`, `bg-accent/20`)으로만 사용.
- **SelectTrigger 기본 height**: `data-[size=default]:h-8` (32px). 인접 버튼도 동일 height(`h-8`)로 통일해야 UI 깨짐 방지. `h-9` 사용 시 4px 불일치.

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
- **폴더 Select**: composite value(`"폴더명:user_id"`), top-level "전체"/"기본폴더" + optgroup 구조. `loadFolders()`는 backend grouped 응답을 위해 userId 필터 없이 호출. 두 Select(메인·이동) 스타일 동기화 필수.
- **`addCategory()` folder·userId 전파**: `useCategories.addCategory()` → `createCategory()` → API 까지 `folder`·`userId` 파라미터 전달 필수. `folder` 누락 시 기본폴더(null)로 생성. `userId` 누락 시 admin이 다른 회원 폴더를 선택해도 본인 소유로 생성됨. hook interface 타입(`UseCategoriesReturn`)도 갱신 필수.
- **`addCategory()` 에러 re-throw**: hook 내부 catch 후 `throw err`로 재전파 → caller try/catch에서 성공 시에만 input 초기화. 미적용 시 에러 상황에서도 입력값이 초기화됨.
- **폴더 이동**: 선택이동·전체이동 버튼은 `window.confirm()`으로 개수 고지. 전체이동은 `getCategories`로 현재 필터에 해당하는 개수를 먼저 조회 후 confirm에 표시. 이동할 폴더 Select는 현재 선택 폴더 disabled.
- **폴더 Select 변경 → 이동할 폴더 초기화**: 폴더 Select의 `onValueChange`에서 새 선택값이 `moveTargetFolder`와 일치하면 `setMoveTargetFolder("")`로 초기화. disabled로 남는 문제 방지.
- **커스텀 이벤트 리스너 레이스 컨디션**: 동일 `CustomEvent` 다중 리스너는 동기 실행. 자식 컴포넌트는 부모 콜백 호출 금지, 로컬 상태만 초기화. 부모가 유일한 데이터 재로드 주체.
- **`onFolderChange` URL 보존**: 폴더 변경 시 `updateURL({ folder, userId, page: 1 })` 사용. 수동 `URLSearchParams` 생성 시 `filter` 등 기존 파라미터 소실됨.
- **useCategories mutation reload 컨텍스트**: `addCategory()`·`deleteCategory()` 내부 GET reload 시 `currentFolder` 등 모든 ref 전달 필수. `loadCategories`가 ref 갱신, mutation 함수가 ref 소비.