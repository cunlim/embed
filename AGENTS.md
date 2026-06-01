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
- **작업 완료 전 검증** — `.claude/hooks/run-all-checks.sh` 실행 후 `cat .claude/hooks/test-results/*.txt`로 결과 확인. tsc, lint, test, pint 모두 EXIT=0 확인 후 마무리.

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

- **Sub-agent 동일 파일 수정** — 여러 Task가 같은 파일을 수정하면 하나의 Agent에 통합. interface 필드 추가 시 agent가 이전 블록 미삭제 가능하므로 수정 후 `grep`으로 중복 키 확인.
- **Docker 바인드 마운트 불일치** — 호스트·컨테이너 간 파일 변경 즉시 반영 안 될 수 있음. 수정 후 `wc -l`로 양쪽 확인. 신규 디렉토리는 양쪽 `mkdir -p`. Pint는 `/tmp/` 경유.
- **API 필터 파라미터 전파 체인** — 새 파라미터 추가 시 frontend(api.ts → hooks → embed-page-inner.tsx → page.tsx → category-hierarchy.tsx), backend(모든 조회 컨트롤러), test mock 모두 수정 필요. 생성 API(`createCategory`)도 동일 — `api.ts` → `useCategories.addCategory()` → `embed-page-inner.tsx` 핸들러 체인 + 백엔드 `store()`·`CategoryStoreRequest`까지 전파. hook interface 타입(`UseCategoriesReturn`)도 갱신 필수. 한 곳만 수정하면 나머지는 이전 동작 유지.
- **SSR 조건부 렌더링** — `getToken()`은 SSR 시 `null`. 인증 기반 분기는 `serverHadToken` prop 사용.
- **Laravel `boolean` 유효성 검증** — `"true"`/`"false"` 불허. 쿼리 파라미터는 `params.set(key, bool ? "1" : "0")` 사용.
- **`category_code` unique 범위** — `(category_code, user_id, folder)`. `CategoryStoreRequest`·`CategoryUpdateTextRequest`에 folder scope 필수. `useCategories.addCategory()` → `createCategory()` → API까지 `folder` 파라미터 전파 필수. 누락 시 기본폴더(null)로 생성되어 중복 체크 오작동.
- **`기본폴더` 정의** — `"기본폴더"`는 폴더가 설정되지 않았음을 의미. DB에서 `folder = NULL`로 저장. 프론트엔드 `api.ts`에서 `"기본폴더"` 전송 시 folder 파라미터 미전송으로 변환. 백엔드에서도 `store()`·`moveFolder()`에서 `"기본폴더"` → `null` 변환 (defense in depth). 조회 시 `folder=기본폴더` → `WHERE folder IS NULL`로 처리. 카테고리 생성 시 `"기본폴더"`를 리터럴 문자열로 저장하면 안 됨.
- **admin `user_id` 우선 규칙** — 조회·생성 모두 적용. **조회**: 관리자가 URL에 `user_id`를 명시하여 특정 회원의 카테고리를 조회할 때 `filter=my`가 있어도 `user_id`를 우선 적용. `CategoryController::index()`·`RecommendController::recommend()`에서 `user_id` 파라미터가 있으면 `filter=my` 무시. **생성**: 관리자가 특정 회원 폴더를 선택한 후 카테고리를 추가하면 해당 회원 소유로 생성. 프론트 `selectedUserId` → `addCategory(userId)` → `createCategory(userId)` → API body `user_id` 전파. 백엔드 `CategoryController::store()`에서 `isAdmin() && filled('user_id')`일 때 `targetUserId` 사용. `CategoryStoreRequest` unique 검증도 `targetUserId` 기준.
- **`RecommendRequest` filter** — `in:my,all`로 `"all"`도 허용 필수. 프론트에서 "전체" 선택 후 유사도검색 시 `filter=all` 전송됨.
- **`onFolderChange` URL 파라미터 보존** — 폴더 변경 시 `onFolderChange` 핸들러에서 URL을 수동 생성하면 기존 파라미터(`filter` 등)가 소실됨. `updateURL({ folder, userId, page: 1 })`을 사용하여 기존 파라미터를 보존해야 함. `updateURL()`은 `page` 오버라이드를 지원.
- **폴더 Select** — composite value(`"폴더명:user_id"`), `SelectGroup`+`SelectLabel`. 상세: `nextjs/AGENTS.md`·`[[frontend/core]]`.
- **폴더 이동** — `window.confirm()`으로 개수 고지. 이동할 폴더 Select는 현재 선택 폴더 disabled. 백엔드 `{moved, failed, message}` 응답 → 프론트 `toast()`로 통계 피드백. 상세: `nextjs/AGENTS.md`·`[[frontend/core]]`·`[[laravel/core]]`.
- **Hook 에러 re-throw** — hook 내부에서 에러 catch 후 `throw err`로 재전파 필수. 상세: `nextjs/AGENTS.md`.
- **커스텀 이벤트 다중 리스너 레이스 컨디션** — 동일 `CustomEvent`에 여러 컴포넌트가 리스너를 등록하면 모든 핸들러가 동기 실행. 자식 컴포넌트의 이벤트 핸들러는 부모 콜백(onFolderChange 등)을 호출하지 말고 로컬 상태만 초기화. 부모가 유일한 데이터 재로드 주체여야 하며, 자식이 부모 콜백을 통해 `loadCategories`를 호출하면 stale closure로 올바른 데이터를 덮어씀.
- **`useCategories` mutation reload 컨텍스트 완전성** — `addCategory()`·`deleteCategory()` 내부 reload(`getCategories`)는 `currentPage`·`currentPerPage`·`currentFilter`·`currentSearch`·`currentFolder` 모든 ref를 전달해야 함. `loadCategories`에서 ref 갱신 → mutation 함수에서 ref 소비 구조. 새 컨텍스트 파라미터 추가 시 ref 선언과 reload 호출 인자 양쪽 모두 업데이트.

## 하위 디렉토리

- 백엔드: [`laravel/AGENTS.md`](laravel/AGENTS.md)
- 프론트엔드: [`nextjs/AGENTS.md`](nextjs/AGENTS.md)
