# Embed 필터 섹션 버그 수정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** embed 페이지 필터 섹션의 4가지 버그 수정

**Architecture:** Next.js 클라이언트 컴포넌트 2개(`category-hierarchy.tsx`, `embed-page-inner.tsx`) + API 클라이언트(`api.ts`) + Laravel 백엔드(`RecommendController`, `RecommendRequest`, `RecommendationService`) 수정. 전형적인 프론트→API→백엔드 데이터 흐름을 따름.

**Tech Stack:** Next.js 16, React 19, TypeScript, Laravel 13, PHP 8.4, PostgreSQL/pgvector

**Spec:** `docs/superpowers/specs/2026-05-25-embed-filter-bugs-design.md`

---

### Task 1: Bug 1 - handle대Change에서 대분류 리프 감지 및 모달 호출

**Files:**
- Modify: `nextjs/components/admin/category-hierarchy.tsx:166-174` (handle대Change)
- Modify: `nextjs/components/admin/category-hierarchy.tsx:108-110` (초기 복원 useEffect)

대분류만 존재하는 카테고리(중분류 없음) 선택 시 모달이 열리지 않는 버그 수정.

- [ ] **Step 1: handle대Change에 리프 감지 추가**

`handle대Change`의 `setLoading중(true)` try 블록에서 `set중Options` 직후 중 옵션이 비어있으면 `onSelectLeafPath` 호출:

```typescript
// line 166-174 수정
setLoading중(true);
try {
  const res = await fetchCategoryLevels({ 대: v }, token);
  const 중List = res.data.중 ?? [];
  if (중List.length === 0) {
    onSelectLeafPath?.(v, "", "", res.data.leafCategoryId ?? null);
  }
  set중Options(중List);
} catch {
  // quietly ignore
} finally {
  setLoading중(false);
}
```

- [ ] **Step 2: 초기 복원 useEffect에 리프 감지 추가**

URL에서 복원 시 `cat1`만 있고 하위 카테고리가 없을 때도 모달이 열리도록, `fetchCategoryLevels` then 콜백에 빈 중 옵션 체크 추가:

```typescript
// line 108-110 수정
fetchCategoryLevels({ 대: 대! }, token ?? undefined).then((res) => {
  const 중List = res.data.중 ?? [];
  if (중List.length === 0) {
    onSelectLeafPath?.(대!, "", "", res.data.leafCategoryId ?? null);
  }
  set중Options(중List);
}).catch(() => {});
```

---

### Task 2: Bug 2 - 유사도 검색 시 hierarchy 키워드 필터링 적용

**Files:**
- Modify: `nextjs/app/embed/embed-page-inner.tsx:175-191` (handleSearch)
- Modify: `nextjs/app/embed/embed-page-inner.tsx:214-230` (handleKeywordSearch)
- Modify: `nextjs/lib/api.ts:97-114` (recommend)
- Modify: `laravel/app/Http/Requests/RecommendRequest.php:20-26` (rules)
- Modify: `laravel/app/Http/Controllers/Api/RecommendController.php:61-115` (recommend)
- Modify: `laravel/app/Services/RecommendationService.php:57-88` (recommendPaginated)

유사도 검색 결과에 hierarchy 필터가 적용되지 않는 버그 수정. hierarchy keyword를 프론트→API→백엔드 전체 파이프라인에 전달.

- [ ] **Step 1: `recommend()` API 함수에 keyword 파라미터 추가**

```typescript
// lib/api.ts
export function recommend(
  text: string,
  targetLanguage: string,
  token?: string | null,
  page?: number,
  perPage?: number,
  filter?: string,
  keyword?: string,
): Promise<RecommendResponse> {
  const body: Record<string, string | number> = { text, target_language: targetLanguage };
  if (page) body.page = page;
  if (perPage) body.per_page = perPage;
  if (filter) body.filter = filter;
  if (keyword) body.keyword = keyword;
  return request<RecommendResponse>("/recommend", {
    method: "POST",
    body,
    token,
  });
}
```

- [ ] **Step 2: `handleSearch`에 keyword 파라미터 추가 및 `recommend` 호출 시 전달**

```typescript
// embed-page-inner.tsx, line 175
const handleSearch = useCallback(async (page?: number, keyword?: string) => {
  const currentPage = page ?? 1;
  searchPageRef.current = currentPage;
  setIsSearching(true);
  setSearchError(null);
  setKeywordSearchActive(false);
  try {
    const data = await recommend(searchText, searchLanguage, token, currentPage, perPageRef.current, filterRef.current, keyword);
    setSearchResults(data.data);
    setSearchMeta(data.meta);
  } catch (err) {
    setSearchError(err instanceof Error ? err.message : "검색에 실패했습니다");
    setSearchResults([]);
  } finally {
    setIsSearching(false);
  }
}, [searchText, searchLanguage, token]);
```

- [ ] **Step 3: `handleKeywordSearch`에서 keyword를 `handleSearch`로 전달**

```typescript
// embed-page-inner.tsx, line 214-218 수정
const handleKeywordSearch = useCallback((keyword: string) => {
  if (searchResults !== null) {
    handleSearch(1, keyword || undefined);
    return;
  }
  // ... 나머지는 동일
```

- [ ] **Step 4: Laravel RecommendRequest에 keyword validation 추가**

```php
// RecommendRequest.php rules()에 추가
'keyword' => ['nullable', 'string', 'max:500'],
```

- [ ] **Step 5: RecommendController에 keyword 처리 추가**

```php
// RecommendController.php, $filter = ... 다음 줄에 추가
$keyword = $request->validated('keyword');

// recommendPaginated 호출에 keyword 전달
$results = $this->recommendation->recommendPaginated(
    $searchLog, $targetLanguage, $perPage, $page, $scopeUserId, $keyword
);
```

- [ ] **Step 6: RecommendationService에 keyword 필터링 추가**

```php
// RecommendationService.php, recommendPaginated 시그니처에 keyword 추가
public function recommendPaginated(
    SearchLog $searchLog,
    string $targetLanguage,
    int $perPage = 20,
    int $page = 1,
    int|array|null $userId = null,
    ?string $keyword = null,
): LengthAwarePaginator

// userId 필터링 이후에 keyword 필터링 추가 (line 75 이후)
if ($keyword) {
    // 대분류>중분류>소분류 경로 prefix 매칭 (name_ko 컬럼 기준)
    $query->where('categories.category_name_ko', 'like', $keyword . '%');
}
```

---

### Task 3: Bug 3 - 모달 텍스트 수정 시 리스트 행 업데이트

**Files:**
- Modify: `nextjs/app/embed/embed-page-inner.tsx:820`

`onUpdateListRow` 콜백이 `translation_status`만 전달하고 카테고리명 필드를 누락하는 버그 수정.

- [ ] **Step 1: onUpdateListRow 콜백 수정**

```typescript
// embed-page-inner.tsx, line 820 수정
onUpdateListRow={(row) => updateCategoryStatus(row.id, {
  translation_status: row.translation_status as Category["translation_status"],
  category_name_ko: row.category_name_ko,
  category_name_zh: row.category_name_zh,
  category_name_en: row.category_name_en,
})}
```

---

### Task 4: Bug 4 - 옵션 없음 상태에서 중분류/소분류 select disabled

**Files:**
- Modify: `nextjs/components/admin/category-hierarchy.tsx:388` (중분류 disabled)
- Modify: `nextjs/components/admin/category-hierarchy.tsx:408` (소분류 disabled)

중분류/소분류 select의 `disabled` 조건에 옵션 배열이 비어있을 때도 비활성화하는 조건 추가.

- [ ] **Step 1: 중분류 select disabled 조건 수정**

```typescript
// line 388 수정
disabled={!selected대 || loading중 || (중Options.length === 0 && !!selected대 && !loading중)}
```

- [ ] **Step 2: 소분류 select disabled 조건 수정**

```typescript
// line 408 수정
disabled={!selected중 || loading소 || (소Options.length === 0 && !!selected중 && !loading소)}
```

---

### Task 5: 통합 검증 및 마무리

**Files:**
- 모든 수정 파일

- [ ] **Step 1: TypeScript 타입 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 2: PHP Pint 포맷팅**

```bash
docker exec cl_embed_laravel bash -c 'cp /var/www/html/app/Http/Requests/RecommendRequest.php /tmp/ && cp /var/www/html/app/Http/Controllers/Api/RecommendController.php /tmp/ && cp /var/www/html/app/Services/RecommendationService.php /tmp/ && vendor/bin/pint /tmp/RecommendRequest.php /tmp/RecommendController.php /tmp/RecommendationService.php && cp /tmp/RecommendRequest.php /var/www/html/app/Http/Requests/ && cp /tmp/RecommendController.php /var/www/html/app/Http/Controllers/Api/ && cp /tmp/RecommendationService.php /var/www/html/app/Services/'
```

- [ ] **Step 3: `run-all-checks.sh` 실행**

```bash
bash .claude/hooks/run-all-checks.sh
```

- [ ] **Step 4: Playwright 검증**

3가지 버그가 모두 수정되었는지 Playwright로 확인:
1. "테스트3" 대분류 선택 시 모달 자동 오픈
2. 유사도 검색 후 "도서" 필터 적용 시 도서 카테고리만 표시
3. 모달에서 텍스트 수정 후 리스트에 반영
