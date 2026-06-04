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
- **async batch 진행률 `flushSync`**: `nextjs/AGENTS.md` 알려진 이슈 참조.
- **task-execution 단계별 재시도**: `MAX_RETRIES=2`(총 3회), `RETRY_DELAY_MS=1000`(지수 증가). `status:"failed"`(422 등)는 재시도 안 함. `STEP_DELAY_MS=2000`(단계 간 지연). `handleRetry`는 `retryParamsRef` → `fetchBatchStatus` 재호출로 stale 데이터 방지.
- **`ApiError` 클래스**: `api.ts`에서 HTTP status 보존. `request()` → `throw new ApiError(msg, res.status)`. 422(재시도 불가) vs 500(재시도) 판별용.
- **`moveCategoriesToFolder` `targetUserId`**: 관리자 소유권 이전용 파라미터. `folder-section.tsx`에서 composite value(`"폴더명:userId"`) 파싱해 추출.
- **비로그인 사이드바 auth-gating**: `{serverHadToken && (...)}`로 추가·다운로드·삭제 섹션 숨김. 유사도 검색·필터·작업 실행은 항상 표시.
- **`fetchCategoryTranslations` `noPreview` 옵션**: `noPreview: true` → `?no_preview=true`로 임베딩 벡터 제외. 카테고리 모달 상세 조회에서 사용. 배치 작업은 `batch-status` API로 대체됨.
- **batch `onComplete`·`onCategoryComplete` 콜백**: `filterRef.current`로 현재 필터 읽기. `onComplete`는 `loadCategories(1, ...)` + `updateURL({ page: 1 })`로 URL 동기화. `onCategoryComplete`는 루프 중 `loadCategories` 호출 금지 (page 불일치). `stepsRef.current`도 reload 시 전달.
- **setState updater 내 부수 효과 금지**: `setState(prev => { ... })` updater 함수는 순수해야 함 (React Strict Mode에서 2회 호출). updater 내부에서 `onStepsChange` 등 콜백을 통해 `loadCategories`(자체 setState + API)를 호출하면 "Cannot update a component while rendering" 에러 + API 중복 호출. **해결**: updater 밖에서 새 상태 계산 → `setState(next)` + 부수 효과 별도 호출. `task-execution.tsx` `toggleStep` 참조.
- **TaskExecution `onStepsChange` + 기본 해제**: `checkedSteps` 기본값 `new Set()` (전체 해제). 체크박스 토글 시 `onStepsChange(steps)` 콜백 → `EmbedPageInner`의 `handleStepsChange`가 `stepsRef` 갱신 + `loadCategories(1, ..., steps)`로 page=1 리셋. **`toggleStep`은 `setCheckedSteps` updater 외부에서 `onStepsChange` 호출** (updater purity). `CategoryController::index()`는 `steps[]` 파라미터로 `determineMissingSteps`와 동일 로직 필터링. `steps` 파라미터는 frontend 전 체인(`api.ts` → `useCategories` → `embed-page-inner.tsx` 모든 `loadCategories` 호출 지점)과 backend(`index()`) 모두 전파.
- **progress `initialTotalSteps`**: `BatchProgress`에 `initialTotalSteps` 추가. 큐 구성 시 저장, `queueEmpty` 시에도 보존. progress `[N/M]`은 step 수 기준.
- **`handleLangChange` 깜빡임 방지**: 언어 변경 시 `setLevelOptions([])`로 초기화하면 `hasOptions=false` → 필터 섹션 통째로 사라짐. **`levelOptions`는 유지**하고 `selectedPath`·`loadingStates`·`keywordText`만 초기화.
- **`onLangChange` 콜백 통합**: `handleLangChange`에서 `onLangChange`와 `reportFilterChange`를 별도 호출하면 `updateURL`가 두 번 실행되어 두 번째 호출이 첫 번째의 `lang` 설정을 덮어씀. `onLangChange(lang, mode, catPath, keyword)` 시그니처로 부모에게 한 번에 전달.
- **필터 언어 radio button 오른쪽 정렬**: `category-hierarchy.tsx`의 언어 버튼 컨테이너에 `justify-end` 클래스 필수.
- **URL 동기화 지연 해결**: `router.replace()`·`router.push()`는 Next.js App Router에서 비동기(1~5초 지연). `window.history.replaceState()`·`pushState()`로 즉시 업데이트. `searchParams` 대신 `window.location.search` 읽기. `page`는 `useState`로 관리. `updateURL`·`handlePageChange`·per-page select·`resetToDefault` 모두 적용됨.
- **마이페이지 `/mypage`**: 독립 경로. 서버 컴포넌트에서 `auth_token` 쿠키 → `getUser(token)` → 미인증 시 `/login?redirect=/mypage`. 헤더 닉네임 `<Link href="/mypage">`. 구성: API key 관리(`api-key-section`·`api-key-card`·`api-key-create-dialog`), 사용량 대시보드(`usage-dashboard`), 차트(`usage-chart`), 이력(`usage-history`).
- **관리자 회원 관리**: `admin/layout.tsx` MENU에 `"users"`(Users 아이콘). `user-management.tsx` → `fetchAdminUsers()`로 회원 목록 테이블. "관리" 버튼 → `user-detail-modal.tsx`에서 `getAdminUserDetail()`로 상세(기본정보+사용량+key별). `quota-adjust-dialog.tsx`에서 absolute/increment 조절 → `adjustUserQuota()`.
- **ESLint `set-state-in-effect` 데이터 fetch 패턴**: useEffect에서 비동기 함수 직접 호출 시 내부 setState가 동기 트리거로 에러. `async function init() { await fn(); }` 래핑 필수. `useApiKeys`·`useUsageStats`·`user-detail-modal`·`user-management` 모두 적용.
- **`Math.random()` render 중 호출 금지**: React purity 규칙 위반. skeleton loading에서 랜덤 height 필요 시 `(i * 17 + 13) % 50` 등 결정적 수식 사용.