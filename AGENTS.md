# AGENTS.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참고할 가이드라인을 제공합니다.

## 문서화 언어 규칙

- **모든 문서와 주석은 한국어로 작성합니다.**
- 코드 식별자(변수명, 함수명, 클래스명 등)는 영어를 유지합니다.

## 언어 순서 규칙

- **모든 UI·API에서 언어 순서는 `ko → en → zh`(한영중)로 통일** — 토글 버튼, 모달, API 응답, SQL foreach 등 신규 요소 추가 시 이 순서 준수.

## plugin, skills, mcp 사용

* 모든 프론트엔드 UI 작업은 `ui-ux-pro-max:ui-ux-pro-max` plugin을 활성화하여 수행한다.
* 구현 계획 수립, 코드 리뷰, TDD 등 구조적 접근이 필요한 작업은 `superpowers` plugin을 활성화하여 수행한다.
* 버그 수정 후 동일 유형의 실수를 방지하려면 `compound-engineering` plugin으로 학습 문서를 갱신한다.

## 작업 워크플로

- **이슈 사전 재현** — 수정 작업 전 Playwright로 실제 이슈가 존재하는지 먼저 확인한다.
- **Sub-agent driven** — 구현은 되도록 Agent(Sub-agent)를 활용한다.
- **Playwright 테스트 URL** — WSL2 호스트에서 `https://embed.cunlim.dev`로 접속 (Next.js 포트 미공개).
- **Playwright 인증** — 쿠키 기반(`auth_token`). superadmin 토큰 발급은 `laravel/AGENTS.md` 참조. 쿠키 설정은 `context.clearCookies()` → `page.evaluate(t => document.cookie = \`auth_token=${t}; path=/; SameSite=Lax; max-age=86400\`, token)` 방식 사용 (`addCookies`는 API 요청에 미포함되는 경우 있음). `/api/auth/user` 200 확인 후 진행.
- **작업 완료 전 검증** — `.claude/hooks/run-all-checks.sh --terminal` 실행하여 결과를 터미널에서 직접 확인. 훅 모드(Stop hook)에서는 Windows 알림으로 전송. test-results/*.txt 파일은 항상 기록. tsc, lint, test, pint 모두 EXIT=0 확인 후 마무리.

## 문서 우선순위

- **3축 기준 문서** — `PRD`(Why/What), `ADR`(How), `UI_GUIDE`(UI). `docs/superpowers/specs`와 `plans`는 작업 기록. 기준 문서와 충돌 시 실제 코드 우선.

## Docs 페이지 시스템

- **`/docs?doc=SLUG`** 단일 라우트, 서버 컴포넌트(`app/docs/page.tsx`) + 클라이언트 레이아웃(`app/docs/layout.tsx`)
- **문서 등록**: `lib/docs.ts` → `docList` 배열에 `{ slug, title, description }` 추가
- **콘텐츠**: `public/content/{SLUG}.md` — react-markdown + remark-gfm 렌더링
- **사이드바**: `CollapsibleSidebar` + `<Suspense>` → `useSearchParams().get("doc")` 으로 active 표시
- **문서 목록** (2026-06-06): USER_GUIDE, API_V1, SIMILARITY_SEARCH, RESUME
- **API 문서** (`API_V1`): API v1 검색 파라미터 상세 + Swagger 사용법 — `nextjs/public/content/API_V1.md`

## Subagent-Driven Development worktree 주의사항

- **worktree agent 수정 파일은 메인에 미반영** — `cp <worktree-path> <main-path>`로 수동 동기화. 완료 후 `git -C <메인-repo> status`로 누락 확인.
- **worktree agent의 git commit 실패** — 컨트롤러가 머지 후 직접 커밋.
- **머지 후 worktree branch 삭제 실패** — `rm -rf .git/worktrees/<name>` 후 `git branch -D <branch>`.
- **worktree agent 사용 전 stale worktree 정리** — `rm -rf .claude/worktrees/* && rm -rf .git/worktrees/* && git worktree prune`.

## 카테고리 접근 제어

- **user scope 규칙** — `user_id=1`(공개), 비로그인: 본인+공개, 로그인: 본인+공개, admin: 전체. 모든 카테고리 조회 API(`levels()`, `recommend()` 등)에 동일 적용.

## 알려진 이슈

- **Sub-agent 동일 파일 수정** — 여러 Task가 같은 파일을 수정하면 하나의 Agent에 통합. interface 필드 추가 시 agent가 이전 블록 미삭제 가능하므로 수정 후 `grep`으로 중복 키 확인.
- **Docker 바인드 마운트 불일치** — 호스트·컨테이너 간 파일 변경 즉시 반영 안 될 수 있음. 수정 후 `wc -l`로 양쪽 확인. 신규 디렉토리는 양쪽 `mkdir -p`. Pint는 `/tmp/` 경유.
- **API 필터 파라미터 전파 체인** — 새 파라미터 추가 시 frontend(api.ts → hooks → embed-page-inner.tsx → page.tsx → category-hierarchy.tsx), backend(모든 조회 컨트롤러), test mock 모두 수정 필요. `TaskExecution`의 `onStepsChange` → `loadCategories`도 동일 체인. 생성 API(`createCategory`)도 동일 — `api.ts` → `useCategories.addCategory()` → `embed-page-inner.tsx` 핸들러 체인 + 백엔드 `store()`·`CategoryStoreRequest`까지 전파. hook interface 타입(`UseCategoriesReturn`)도 갱신 필수. 한 곳만 수정하면 나머지는 이전 동작 유지.
- **SSR 조건부 렌더링** — `getToken()`은 SSR 시 `null`. 인증 기반 분기는 `serverHadToken` prop 사용.
- **Laravel `boolean` 유효성 검증** — `"true"`/`"false"` 불허. 쿼리 파라미터는 `params.set(key, bool ? "1" : "0")` 사용.
- **`category_code` unique 범위** — `(category_code, user_id, folder)`. `CategoryStoreRequest`·`CategoryUpdateTextRequest`에 folder scope 필수. `useCategories.addCategory()` → `createCategory()` → API까지 `folder` 파라미터 전파 필수. 누락 시 기본폴더(null)로 생성되어 중복 체크 오작동.
- **`기본폴더` 정의** — `"기본폴더"`는 폴더가 설정되지 않았음을 의미. DB에서 `folder = NULL`로 저장. 프론트엔드 `api.ts`에서 `"기본폴더"` 전송 시 folder 파라미터 미전송으로 변환. 백엔드에서도 `store()`·`moveFolder()`에서 `"기본폴더"` → `null` 변환 (defense in depth). 조회 시 `folder=기본폴더` → `WHERE folder IS NULL`로 처리. 카테고리 생성 시 `"기본폴더"`를 리터럴 문자열로 저장하면 안 됨.
- **admin `user_id` 우선 규칙** — 조회·생성 모두 적용. **조회**: 관리자가 URL에 `user_id`를 명시하여 특정 회원의 카테고리를 조회할 때 `filter=my`가 있어도 `user_id`를 우선 적용. `CategoryController::index()`·`RecommendController::recommend()`에서 `user_id` 파라미터가 있으면 `filter=my` 무시. **생성**: 관리자가 특정 회원 폴더를 선택한 후 카테고리를 추가하면 해당 회원 소유로 생성. 프론트 `selectedUserId` → `addCategory(userId)` → `createCategory(userId)` → API body `user_id` 전파. 백엔드 `CategoryController::store()`에서 `isAdmin() && filled('user_id')`일 때 `targetUserId` 사용. `CategoryStoreRequest` unique 검증도 `targetUserId` 기준.
- **`RecommendRequest` filter** — `in:my,all`로 `"all"`도 허용 필수. 프론트에서 "전체" 선택 후 유사도검색 시 `filter=all` 전송됨.
- **`onFolderChange` URL 파라미터 보존** — 폴더 변경 시 `onFolderChange` 핸들러에서 URL을 수동 생성하면 기존 파라미터(`filter` 등)가 소실됨. `updateURL({ folder, userId, page: 1 })`을 사용하여 기존 파라미터를 보존해야 함. `updateURL()`은 `page` 오버라이드를 지원.
- **폴더 Select** — composite value(`"폴더명:user_id"`), `SelectGroup`+`SelectLabel`. 상세: `nextjs/AGENTS.md`·`[[frontend/core]]`.
- **폴더 삭제 중복 체크** — `destroy()`에서 `move_to_default=true` 시 기본폴더 중복 `(category_code, user_id)` 검사 → 409 거부. `hasCategories` API도 `duplicate_count`/`duplicate_codes` 반환 → 모달에서 radio disabled + 경고. 상세: `[[laravel/core]]`·`[[frontend/core]]`.
- **폴더 이동** — `window.confirm()`으로 개수 고지. 이동할 폴더 Select는 현재 선택 폴더 disabled. 백엔드 `{moved, failed, message}` 응답 → 프론트 `toast()`로 통계 피드백. 상세: `nextjs/AGENTS.md`·`[[frontend/core]]`·`[[laravel/core]]`.
- **Hook 에러 re-throw** — hook 내부에서 에러 catch 후 `throw err`로 재전파 필수. 상세: `nextjs/AGENTS.md`.
- **커스텀 이벤트 다중 리스너 레이스 컨디션** — 동일 `CustomEvent`에 여러 컴포넌트가 리스너를 등록하면 모든 핸들러가 동기 실행. 자식 컴포넌트의 이벤트 핸들러는 부모 콜백(onFolderChange 등)을 호출하지 말고 로컬 상태만 초기화. 부모가 유일한 데이터 재로드 주체여야 하며, 자식이 부모 콜백을 통해 `loadCategories`를 호출하면 stale closure로 올바른 데이터를 덮어씀.
- **`useCategories` mutation reload 컨텍스트 완전성** — `addCategory()`·`deleteCategory()` 내부 reload(`getCategories`)는 `currentPage`·`currentPerPage`·`currentFilter`·`currentSearch`·`currentFolder` 모든 ref를 전달해야 함. `loadCategories`에서 ref 갱신 → mutation 함수에서 ref 소비 구조. 새 컨텍스트 파라미터 추가 시 ref 선언과 reload 호출 인자 양쪽 모두 업데이트.
- **async batch flushSync 패턴** — `nextjs/AGENTS.md` 알려진 이슈 참조.
- **`no_preview` 파라미터 패턴** — 동일 API 엔드포인트를 여러 소비자가 사용할 때 무거운 필드(임베딩 벡터 등)를 쿼리 파라미터로 제어. `?no_preview=true` 시 preview 제외 → 배치 작업 시 응답 크기 절약. `CategoryTranslationsResource`·`fetchCategoryTranslations()` 참조.
- **batch `onComplete`·`onCategoryComplete` 콜백 패턴** — `onComplete`는 `filterRef.current`로 현재 필터를 읽고 `loadCategories(1, ...)` + `updateURL({ page: 1 })`로 URL 동기화. `onCategoryComplete`는 루프 중 `loadCategories` 호출 금지 — page 불일치로 URL의 page=N이 API 요청에 붙는 버그 유발. `CategoryDelete`도 동일 패턴. 상세: `nextjs/AGENTS.md`.
- **progress step 기반 표시** — `BatchProgress` interface에 `initialTotalSteps` 필드 추가. 큐 구성 시 저장, `queueEmpty` 시에도 보존. progress 오른쪽 `[N/M]`은 카테고리 수가 아닌 step 수 기준.
- **batch-status `with('embeddings')` 메모리 초과** — 대량 데이터에서 임베딩 벡터 전체를 이저 로딩하면 메모리 제한(128MB) 초과로 500 에러. 임베딩 존재 여부 확인은 `whereNotNull('embedding')->select('category_id', 'language')` 경량 쿼리 사용. 상세: `laravel/AGENTS.md`.
- **`CategoryController::index()` `steps` 파라미터** — `steps[]=embedding.ko&steps[]=translation.en` 쿼리 파라미터로 체크된 step 중 하나라도 누락된 카테고리만 필터링. `batchStatus`의 `determineMissingSteps`와 동일 로직을 SQL WHERE 조건으로 구현 (embedding 의존성 포함). `TaskExecution` 체크박스 토글 → `onStepsChange` → `loadCategories(1, ..., steps)`로 page=1 리셋 후 호출.
- **`search`·`search_lang` 파라미터** — `GET /api/categories?search=...`는 `category_name_ko`·`category_name_en`·`category_name_zh`·`category_code` 네 필드를 LIKE(`%검색어%`) 부분 검색 (검색 모드). `search_lang=ko|en|zh` 추가 시 해당 언어 컬럼에서만 **접두사 검색**(`검색어>%`) 수행 (분류선택 모드). 미지정 시 다국어 부분 검색 동작. 전파 체인: `embed-page-inner.tsx`(`hierarchyLangRef.current`) → `loadCategories()`(8번째 인자) → `getCategories()`(`search_lang` 쿼리 파라미터) → 백엔드 `index()`·`batchStatus()`. `page.tsx` SSR 프리페치에서도 `hierarchyLang` 전달. **⚠️ 검색 모드의 키워드 검색에는 `search_lang`을 전달하면 안 됨** — `handleKeywordSearch`에서 `loadCategories` 호출 시 8번째 인자를 생략해야 부분 검색(`%검색어%`)이 적용됨.
- **`lang` URL 파라미터 (분류선택 계층 언어)** — `lang=ko|en|zh`, 기본값 `ko`. 분류선택 필터의 계층 드롭다운 표시 언어를 제어. 전파 체인: `embed-params.ts`(파싱) → `embed-page-inner.tsx`(상태) → `updateURL()`(URL 동기화) → `page.tsx`(SSR 프리페치) → `CategoryHierarchy`(props). 백엔드 `CategoryController::levels()`에서 `$langColumn = 'category_name_'.$lang`로 동적 컬럼 선택.
- **URL 동기화 지연 (`router.replace`/`router.push`)** — Next.js App Router에서 `router.replace()`·`router.push()`는 비동기. `searchParams`는 React 렌더링 시점 스냅샷이므로 빠른 연속 호출 시 stale 값을 읽어 race condition 발생 (1~5초 지연). **해결**: `window.history.replaceState()`·`pushState()`로 즉시 URL 업데이트. `searchParams.toString()` 대신 `window.location.search`에서 현재 URL 읽기. `page`는 computed 값이 아닌 `useState`로 관리하여 즉시 반영. `resetToDefault`에서 이미 사용 중인 패턴. 상세: `nextjs/AGENTS.md`.
- **`RecommendService::recommendPaginated()` `searchLang` 파라미터** — keyword 필터 시 언어별 접두사/부분 검색 분기. `searchLang=ko` → `category_name_ko LIKE 'keyword%'` (접두사), `searchLang=null` → 다국어 부분 검색 (`%keyword%`). 외부 API(`/api/v1/search`)에서 `mode=hierarchy`+`lang=ko` 시 `searchLang=ko` 전달. `RecommendController`에서는 미전달(기존 동작 유지). 상세: `laravel/AGENTS.md`.
- **외부 API 패턴 (`/api/v1/search`)** — API key 인증(`ApiKeyAuth`), quota 체크, rate limit(`ApiRateLimit`) 미들웨어 체인. Swagger에 `External API` 태그로 문서화됨. 파라미터: `folder`·`text`·`target_language`·`mode`·`keyword`·`lang`·`page`·`per_page`. `filter`는 내부에서 항상 `'my'` 고정(외부 노출 안 함). quota 감소는 `DB::table()->decrement()`로 직접 처리(모델 이벤트 우회). 응답은 `data[]`·`meta{current_page,last_page,per_page,total}`만 반환 (links·meta.links·meta.path 제거). 상세: `laravel/AGENTS.md`·`docs/api-v1.md`.
- **`isLoading` + `!!token` hydration mismatch** — `useState(!!token)`으로 초기화하면 서버(`getToken()`=null → `false`)와 클라이언트(쿠키 존재 → `true`) 불일치로 hydration 에러 발생. `useAuth`·`useApiKeys`·`useUsageStats` 등 토큰 기반 데이터 fetch 훅 모두 해당. **해결**: 초기값을 `false`로 고정, `useEffect` 내에서 `setIsLoading(true)` 후 fetch.
- **`#[Hidden]` 모델 필드 + accessor 패턴** — `#[Hidden(['key'])]` 등으로 JSON 직렬화에서 제외된 필드를 프론트엔드에서 직접 참조하면 `undefined` 에러 발생. **해결**: 백엔드에서 `$appends` + `Attribute` accessor로 안전한 미리보기 값 제공 (예: `key_preview`로 잘린 키 표시). 프론트엔드 타입에도 optional + preview 필드 추가. **생성 시점 노출**: 컨트롤러 store 메서드에서 `$model->makeVisible('key')` 호출하여 생성 응답에만 평문 포함. 프론트는 `apiKey.key` 존재 시에만 복사 버튼 표시 + `"새로고침 전 복사하세요"` amber 배지로 고지. 상태 업데이트(rename·toggle) 시 `{ ...prev, ...response.data }`로 hidden 필드 보존.
- **`api_usage_logs` FK cascade 주의** — `api_key_id` FK가 `onDelete('cascade')`이면 키 삭제 시 사용 로그 전체가 소실되어 차트·이력이 비어 보임. `onDelete('set null')`로 변경 + 컬럼 nullable 마이그레이션 필요. 프론트 `UsageHistory`는 `item.api_key?.name ?? "-"`로 삭제된 키 대응.
- **`QuotaAdjustRequest` 조건부 유효성 검증** — `increment` 모드에서 음수값 허용 필요. `'min:0'` 대신 커스텀 클로저로 `type === 'absolute'`일 때만 0 미만 검증. 백엔드 `adjustQuota()`에서도 `max(0, newValue)`로 최소값 보장.
- **`next-themes` + React 19 `<script>` 경고** — `next-themes` 0.4.6가 React 컴포넌트 내부에서 `<script>` 태그를 렌더링하여 React 19에서 "Encountered a script tag while rendering React component" 경고 발생. `suppressHydrationWarning`로는 해결 불가. 라이브러리 업데이트 전까지 개발 모드 경고로 유지.
- **Admin URL 기반 라우팅** — `admin/layout.tsx`에서 `useState` + `useAdminMenu()` context 대신 `Link` + `usePathname()`으로 URL 기반 네비게이션 사용. `/admin`(시스템 설정), `/admin/member`(회원 관리). 각 페이지는 독립 SSR 인증 게이트.

## 하위 디렉토리

- 백엔드: [`laravel/AGENTS.md`](laravel/AGENTS.md)
- 프론트엔드: [`nextjs/AGENTS.md`](nextjs/AGENTS.md)
