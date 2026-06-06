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

## 작업 워크플로 (5단계)

모든 작업은 아래 단계를 순서대로 따른다. 커스텀 명령어(`/new-feature`, `/fix-bug`, `/finalize`, `/check`)로 자동화 가능.

### Phase 1: 계획 수립

- **신규 기능** — `/superpowers:brainstorming`으로 시작. 요구사항 분석 → 설계 → 구현 계획 수립.
- **버그 수정** — `/superpowers:systematic-debugging`으로 시작. 근본 원인 분석 → 수정 전략 수립.
- **TDD 원칙** — 항상 테스트 먼저 작성(red → green → refactor). `superpowers` plugin의 TDD 워크플로를 따른다.
- **Sub-agent 분해** — 작업을 독립 가능한 단위로 분해하여 Agent에 위임. 병렬 실행 가능 작업은 병렬 dispatch.

### Phase 2: 구현

- **Sub-agent driven** — 구현은 되도록 Agent(Sub-agent)를 활용한다.
- **Playwright 이슈 재현** — 수정 작업 전 Playwright로 실제 이슈가 존재하는지 먼저 확인한다.
- **Playwright 테스트 URL** — WSL2 호스트에서 `https://embed.cunlim.dev`로 접속 (Next.js 포트 미공개).
- **Playwright 인증** — 쿠키 기반(`auth_token`). superadmin 토큰 발급은 `laravel/AGENTS.md` 참조. 쿠키 설정은 `context.clearCookies()` → `page.evaluate(t => document.cookie = \`auth_token=${t}; path=/; SameSite=Lax; max-age=86400\`, token)` 방식 사용 (`addCookies`는 API 요청에 미포함되는 경우 있음). `/api/auth/user` 200 확인 후 진행.
- **Worktree 파일 동기화** — Sub-agent가 worktree에서 수정한 파일은 `cp <worktree-path> <main-path>`로 메인에 복사. 완료 후 `git status`로 누락 확인.

### Phase 3: 검증

- **전체 검증 실행** — `.claude/hooks/run-all-checks.sh --terminal`로 tsc, lint, test, pint 모두 확인.
- **EXIT=0 확인** —任何一个 체크가 실패하면 즉시 수정 후 재실행. 모두 통과할 때까지 반복.
- **Playwright 재검증** — 수정 후 이슈가 해결되었는지 Playwright로 최종 확인 (버그 수정 시).

### Phase 4: 문서 갱신

- **학습 문서 반영** — `AGENTS.md`, `docs/`, `.serena/memories/`, `nextjs/public/content/` 등을 검토.
- **중복 제거·재배치** — 이번 세션에서 배운 것을 등록. 코드 스캔이나 명령어로 알 수 있는 정보는 최대한 축소.
- **`/claude-md-management:revise-claude-md`** 실행하여 자동 정리 (컨펌 없이 바로 적용).

### Phase 5: 커밋

- **`/compound-engineering:ce-commit`** 실행. 변경 사항 분석 → 의미 있는 단위로 커밋 메시지 생성.
- **worktree 정리** — 사용한 worktree가 있으면 정리 (`rm -rf .claude/worktrees/* && rm -rf .git/worktrees/* && git worktree prune`).

## 문서 우선순위

- **3축 기준 문서** — `PRD`(Why/What), `ADR`(How), `UI_GUIDE`(UI). `docs/superpowers/specs`와 `plans`는 작업 기록. 기준 문서와 충돌 시 실제 코드 우선.

## Subagent-Driven Development worktree 주의사항

- **worktree agent 수정 파일은 메인에 미반영** — `cp <worktree-path> <main-path>`로 수동 동기화. 완료 후 `git -C <메인-repo> status`로 누락 확인.
- **worktree agent의 git commit 실패** — 컨트롤러가 머지 후 직접 커밋.
- **머지 후 worktree branch 삭제 실패** — `rm -rf .git/worktrees/<name>` 후 `git branch -D <branch>`.
- **worktree agent 사용 전 stale worktree 정리** — `rm -rf .claude/worktrees/* && rm -rf .git/worktrees/* && git worktree prune`.

## 카테고리 접근 제어

- **user scope 규칙** — `user_id=1`(공개), 비로그인: 본인+공개, 로그인: 본인+공개, admin: 전체. 모든 카테고리 조회 API(`levels()`, `recommend()` 등)에 동일 적용.

## 알려진 이슈

### 크로스 컷팅 (프론트+백엔드 연동)

- **API 필터 파라미터 전파 체인** — 새 파라미터 추가 시 frontend(api.ts → hooks → embed-page-inner.tsx → page.tsx → category-hierarchy.tsx), backend(모든 조회 컨트롤러), test mock 모두 수정 필요. `TaskExecution`의 `onStepsChange` → `loadCategories`도 동일 체인. 생성 API(`createCategory`)도 동일 — `api.ts` → `useCategories.addCategory()` → `embed-page-inner.tsx` 핸들러 체인 + 백엔드 `store()`·`CategoryStoreRequest`까지 전파. hook interface 타입(`UseCategoriesReturn`)도 갱신 필수. 한 곳만 수정하면 나머지는 이전 동작 유지.
- **SSR 조건부 렌더링** — `getToken()`은 SSR 시 `null`. 인증 기반 분기는 `serverHadToken` prop 사용.
- **`onFolderChange` URL 파라미터 보존** — 폴더 변경 시 `onFolderChange` 핸들러에서 URL을 수동 생성하면 기존 파라미터(`filter` 등)가 소실됨. `updateURL({ folder, userId, page: 1 })`을 사용하여 기존 파라미터를 보존해야 함.
- **admin `user_id` 우선 규칙** — 조회·생성 모두 적용. 관리자가 URL에 `user_id`를 명시하면 `filter=my`가 있어도 `user_id`를 우선 적용. 생성 시에도 `selectedUserId` → `addCategory(userId)` → API까지 전파.
- **`기본폴더` 정의** — `"기본폴더"`는 폴더가 설정되지 않았음을 의미. DB에서 `folder = NULL`로 저장. 프론트엔드 `api.ts`에서 `"기본폴더"` 전송 시 folder 파라미터 미전송으로 변환. 백엔드에서도 `store()`·`moveFolder()`에서 `"기본폴더"` → `null` 변환 (defense in depth). 조회 시 `folder=기본폴더` → `WHERE folder IS NULL`로 처리. 카테고리 생성 시 `"기본폴더"`를 리터럴 문자열로 저장하면 안 됨.
- **커스텀 이벤트 다중 리스너 레이스 컨디션** — 동일 `CustomEvent`에 여러 컴포넌트가 리스너를 등록하면 모든 핸들러가 동기 실행. 자식 컴포넌트의 이벤트 핸들러는 부모 콜백을 호출하지 말고 로컬 상태만 초기화. 부모가 유일한 데이터 재로드 주체여야 함.
- **`useCategories` mutation reload 컨텍스트 완전성** — `addCategory()`·`deleteCategory()` 내부 reload는 `currentPage`·`currentPerPage`·`currentFilter`·`currentSearch`·`currentFolder` 모든 ref를 전달해야 함. 새 컨텍스트 파라미터 추가 시 ref 선언과 reload 호출 인자 양쪽 모두 업데이트.
- **async batch flushSync 패턴** — React 19 batching 우회를 위해 `flushSync`로 루프 내 `setProgress`를 감쌈. 상세: `nextjs/AGENTS.md`.
- **`no_preview` 파라미터 패턴** — 동일 API 엔드포인트를 여러 소비자가 사용할 때 무거운 필드(임베딩 벡터 등)를 쿼리 파라미터로 제어.
- **batch `onComplete`·`onCategoryComplete` 콜백 패턴** — `onComplete`는 `filterRef.current`로 현재 필터를 읽고 `loadCategories(1, ...)` + `updateURL({ page: 1 })`로 URL 동기화. `onCategoryComplete`는 루프 중 `loadCategories` 호출 금지.
- **progress step 기반 표시** — `BatchProgress` interface에 `initialTotalSteps` 필드 추가. progress 오른쪽 `[N/M]`은 카테고리 수가 아닌 step 수 기준.

### Sub-agent / Docker

- **Sub-agent 동일 파일 수정** — 여러 Task가 같은 파일을 수정하면 하나의 Agent에 통합. interface 필드 추가 시 agent가 이전 블록 미삭제 가능하므로 수정 후 `grep`으로 중복 키 확인.
- **Docker 바인드 마운트 불일치** — 호스트·컨테이너 간 파일 변경 즉시 반영 안 될 수 있음. 수정 후 `wc -l`로 양쪽 확인. 신규 디렉토리는 양쪽 `mkdir -p`. Pint는 `/tmp/` 경유.

### 프레임워크 / 라이브러리

- **`next-themes` + React 19 `<script>` 경고** — `next-themes` 0.4.6가 React 컴포넌트 내부에서 `<script>` 태그를 렌더링하여 React 19에서 경고 발생. 라이브러리 업데이트 전까지 개발 모드 경고로 유지.
- **Admin URL 기반 라우팅** — `admin/layout.tsx`에서 `Link` + `usePathname()`으로 URL 기반 네비게이션 사용. `/admin`(시스템 설정), `/admin/member`(회원 관리).

### 보안 / 인증

- **`#[Hidden]` 모델 필드 + accessor 패턴** — `#[Hidden(['key'])]` 등으로 JSON 직렬화에서 제외된 필드를 프론트엔드에서 직접 참조하면 `undefined` 에러 발생. 백엔드에서 `$appends` + `Attribute` accessor로 안전한 미리보기 값 제공. 생성 시점에만 `$model->makeVisible('key')`로 평문 포함.
- **`api_usage_logs` FK cascade 주의** — `api_key_id` FK가 `onDelete('cascade')`이면 키 삭제 시 사용 로그 전체 소실. `onDelete('set null')`로 변경 + 컬럼 nullable 마이그레이션 필요.
- **`isLoading` + `!!token` hydration mismatch** — `useState(!!token)`으로 초기화하면 서버/클라이언트 불일치로 hydration 에러 발생. 초기값을 `false`로 고정, `useEffect` 내에서 `setIsLoading(true)` 후 fetch.

## 하위 디렉토리

- 백엔드: [`laravel/AGENTS.md`](laravel/AGENTS.md)
- 프론트엔드: [`nextjs/AGENTS.md`](nextjs/AGENTS.md)
