# Embed 페이지 필터 섹션 버그 수정 설계

## 개요

embed 페이지의 필터 섹션에서 발견된 4가지 버그를 수정한다.

## 버그 목록 및 수정 방안

### Bug 1: 대분류만 존재하는 카테고리 선택 시 모달 미열림

- **파일**: `nextjs/components/admin/category-hierarchy.tsx`
- **원인**: `handle대Change`에서 중 옵션 fetch 후 빈 배열 체크 누락. `handle중Change`, `handle소Change`는 이미 `onSelectLeafPath`를 호출하나 대분류 레벨은 누락됨.
- **수정**: `handle대Change`의 `set중Options(res.data.중 ?? [])` 직후 `res.data.중`이 비어있으면 `onSelectLeafPath(대, "", "", leafCategoryId)` 호출.
- **초기 복원 useEffect**: URL에 `cat1`만 있고 하위가 없을 때도 동일 문제. 중 옵션 fetch 후 빈 배열 체크 및 `onSelectLeafPath` 호출 추가.

### Bug 2: 유사도 검색 시 hierarchy 필터 미적용

- **파일**: `nextjs/app/embed/embed-page-inner.tsx`, `nextjs/lib/api.ts`, Laravel `RecommendController`
- **원인**: `handleKeywordSearch`가 유사도 검색 활성 상태에서 `handleSearch(1)` 호출 시 hierarchy keyword를 전달하지 않음. `recommend()` API도 keyword 파라미터 미지원.
- **수정**:
  1. `handleSearch`에 `keyword?: string` 파라미터 추가
  2. `recommend()` API 함수에 `keyword?: string` 파라미터 추가 → 쿼리 파라미터로 전송
  3. `handleKeywordSearch`에서 `handleSearch(1, keyword)`로 keyword 전달
  4. Laravel `RecommendController`에서 `keyword` 파라미터로 카테고리 경로 필터링

### Bug 3: 모달 텍스트 수정 후 리스트 미반영

- **파일**: `nextjs/app/embed/embed-page-inner.tsx`
- **원인**: `onUpdateListRow` 콜백이 `listRow`에서 `translation_status`만 추출하고 `category_name_ko/zh/en` 필드를 누락.
- **수정**: `updateCategoryStatus` 호출 시 `category_name_ko`, `category_name_zh`, `category_name_en`도 함께 전달.

### Bug 4: 옵션 없음 상태에서 중분류/소분류 select disabled 누락

- **파일**: `nextjs/components/admin/category-hierarchy.tsx`
- **원인**: 중분류 `disabled={!selected대 || loading중}`, 소분류 `disabled={!selected중 || loading소}` — 옵션이 비어있는 경우 미처리. 세분류는 이미 `세Options.length === 0` 조건 포함.
- **수정**:
  - 중분류: `disabled={!selected대 || loading중 || (중Options.length === 0 && !loading중)}`
  - 소분류: `disabled={!selected중 || loading소 || (소Options.length === 0 && !loading소)}`

## 영향 범위

- `category-hierarchy.tsx`: `handle대Change`, 초기 복원 useEffect, 중분류/소분류 disabled 조건
- `embed-page-inner.tsx`: `onUpdateListRow` 콜백, `handleKeywordSearch`, `handleSearch`
- `lib/api.ts`: `recommend()` 함수 시그니처
- Laravel: `RecommendController` (keyword 필터링 로직 추가)
