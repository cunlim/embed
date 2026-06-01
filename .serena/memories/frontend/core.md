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
- **폴더 추가/수정/삭제**: `createFolder()` / `renameFolder()` / `deleteFolder()` → `toast()`로 성공/실패 피드백. `onFolderActionComplete()`는 폴더 이동 후에만 호출. 삭제·수정(rename) 시에는 `onFolderChange`가 이미 올바른 폴더명으로 `loadCategories` 트리거하므로 `onFolderActionComplete` 호출 금지 (stale `selectedFolderRef`로 레이스 컨디션).
  - **삭제 모달 중복 체크**: `hasCategories` API로 `duplicate_count` 확인. 중복 시 "기본폴더로 이동" radio `disabled`+`opacity-50 cursor-not-allowed`, `text-destructive` 경고 (중복 코드 별도 `<p>`에 `truncate` 표시, 3개 초과 시 `, ...`, `title` 툴팁으로 전체 목록 제공), "카테고리도 함께 삭제"로 자동 전환 (`useEffect` + `eslint-disable-next-line react-hooks/set-state-in-effect`). 백엔드 `destroy()`도 409 방어.
- **폴더 이동**: `window.confirm()`으로 개수 고지. 이동할 폴더 Select는 현재 선택 폴더 disabled. API 응답 `{ moved, failed, message }` → `toast.success()` / `toast.warning()` / `toast.error()`로 피드백.
- **폴더 Select 변경 → 이동할 폴더 초기화**: 폴더 Select의 `onValueChange`에서 새 선택값이 `moveTargetFolder`와 일치하면 `setMoveTargetFolder("")`로 초기화. disabled로 남는 문제 방지.
- **커스텀 이벤트 리스너 레이스 컨디션**: 동일 `CustomEvent` 다중 리스너는 동기 실행. 자식 컴포넌트는 부모 콜백 호출 금지, 로컬 상태만 초기화. 부모가 유일한 데이터 재로드 주체.
- **`onFolderChange` URL 보존**: 폴더 변경 시 `updateURL({ folder, userId, page: 1 })` 사용. 수동 `URLSearchParams` 생성 시 `filter` 등 기존 파라미터 소실됨.
- **`resetToDefault` 폴더 초기화**: `resetToDefault()`에서 `setSelectedFolder(null)`, `setSelectedUserId(null)` 필수. 미적용 시 폴더 select가 stale 값 표시. `loadCategories()` 호출 인자도 `undefined`로 변경.
- **useCategories mutation reload 컨텍스트**: `addCategory()`·`deleteCategory()` 내부 GET reload 시 `currentFolder` 등 모든 ref 전달 필수. `loadCategories`가 ref 갱신, mutation 함수가 ref 소비.
- **async batch 진행률 `flushSync`**: React 19가 `await` 경계를 넘어 상태 업데이트를 배칭하여 진행률이 실시간 갱신되지 않을 때, `import { flushSync } from "react-dom"`으로 `flushSync(() => setProgress(...))`를 `await` 직전에 호출하여 강제 렌더링. Phase 1(수집)→Phase 2(실행) 분할 + progress bar 0-50%/50-100% 분할 표시.