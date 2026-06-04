# 분류선택 언어 필터 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** embed 페이지의 "분류선택" 필터에 언어 radio button을 추가하고, 유사도 검색 언어(`slang`)를 radio toggle만으로 URL에 즉시 반영한다.

**Architecture:** 백엔드 `CategoryController::levels()`에 `lang` 쿼리 파라미터를 추가하여 언어별 카테고리 컬럼(`category_name_ko`/`_en`/`_zh`)로 동적 조회한다. 프론트엔드는 `CategoryHierarchy` 컴포넌트에 언어 radio button을 추가하고, 변경 시 모든 드롭다운을 초기화한 뒤 새 언어로 재조회한다. `lang`은 신규 URL 파라미터로 SSR 프리페치를 지원한다.

**Tech Stack:** Laravel (PHP), Next.js App Router (TypeScript), Shadcn UI, Pest (PHP 테스트)

---

## 파일 구조

| 작업 | 파일 | 변경 유형 |
|------|------|----------|
| Task 1 | `laravel/tests/Feature/Api/CategoryLevelsTest.php` | 수정 |
| Task 2 | `laravel/app/Http/Controllers/Api/CategoryController.php:363-529` | 수정 |
| Task 3 | `nextjs/lib/embed-params.ts` | 수정 |
| Task 4 | `nextjs/lib/api.ts` | 수정 (호출부 — 타입 변경 불필요) |
| Task 5 | `nextjs/components/admin/category-hierarchy.tsx` | 수정 |
| Task 6 | `nextjs/app/embed/embed-page-inner.tsx` | 수정 |
| Task 7 | `nextjs/app/embed/page.tsx` | 수정 |
| Task 8 | `nextjs/app/embed/embed-page-inner.tsx` | 수정 |

---

### Task 1: 백엔드 — `levels()` 언어 파라미터 테스트 작성

**Files:**
- Modify: `laravel/tests/Feature/Api/CategoryLevelsTest.php`

- [ ] **Step 1: 기존 테스트 데이터에 영어/중국어 카테고리명 추가**

기존 `beforeEach`의 Category::factory() 호출에 `category_name_en`과 `category_name_zh`를 추가한다.

```php
beforeEach(function () {
    $user = User::factory()->create(['role' => 'superadmin']);

    Category::factory()->create([
        'user_id' => 1,
        'category_name_ko' => '패션의류>여성의류>원피스',
        'category_name_en' => 'Fashion>Women>Dress',
        'category_name_zh' => '时装>女装>连衣裙',
        'category_code' => 'A01',
    ]);
    Category::factory()->create([
        'user_id' => 1,
        'category_name_ko' => '패션의류>여성의류>티셔츠',
        'category_name_en' => 'Fashion>Women>T-shirt',
        'category_name_zh' => '时装>女装>T恤',
        'category_code' => 'A02',
    ]);
    Category::factory()->create([
        'user_id' => 1,
        'category_name_ko' => '패션의류>남성의류>셔츠',
        'category_name_en' => 'Fashion>Men>Shirt',
        'category_name_zh' => '时装>男装>衬衫',
        'category_code' => 'A03',
    ]);
    Category::factory()->create([
        'user_id' => 1,
        'category_name_ko' => '식품>농산물>과일>사과',
        'category_name_en' => 'Food>Agriculture>Fruit>Apple',
        'category_name_zh' => '食品>农产品>水果>苹果',
        'category_code' => 'A04',
    ]);
    Category::factory()->create([
        'user_id' => 1,
        'category_name_ko' => '식품>농산물>채소',
        'category_name_en' => 'Food>Agriculture>Vegetable',
        'category_name_zh' => '食品>农产品>蔬菜',
        'category_code' => 'A05',
    ]);
    Category::factory()->create([
        'user_id' => 2,
        'category_name_ko' => '타유저>중분류>소분류',
        'category_name_en' => 'OtherUser>Mid>Sub',
        'category_name_zh' => '其他用户>中分类>小分类',
        'category_code' => 'A06',
    ]);
    Category::factory()->create([
        'user_id' => 1,
        'category_name_ko' => '테스트리프',
        'category_name_en' => 'TestLeaf',
        'category_name_zh' => '测试叶子',
        'category_code' => 'A07',
    ]);
});
```

- [ ] **Step 2: 영어 언어 파라미터 테스트 추가**

`describe('GET /api/categories/levels')` 블록 끝에 다음 테스트를 추가한다:

```php
test('lang=en이면 영어 카테고리명으로 계층을 반환한다', function () {
    $response = $this->getJson('/api/categories/levels?'.http_build_query(['lang' => 'en']));

    $response->assertOk();
    $data = $response->json('data');
    expect($data['options'])->toContain('Fashion');
    expect($data['options'])->not->toContain('패션의류');
    expect($data['options'])->toContain('Food');
});

test('lang=en이고 대 파라미터가 있으면 영어 중분류를 반환한다', function () {
    $response = $this->getJson('/api/categories/levels?'.http_build_query(['lang' => 'en', 'cat1' => 'Fashion']));

    $response->assertOk();
    $data = $response->json('data');
    expect($data['options'])->toContain('Women');
    expect($data['options'])->toContain('Men');
    expect($data['options'])->not->toContain('여성의류');
});

test('lang=zh이면 중국어 카테고리명으로 계층을 반환한다', function () {
    $response = $this->getJson('/api/categories/levels?'.http_build_query(['lang' => 'zh']));

    $response->assertOk();
    $data = $response->json('data');
    expect($data['options'])->toContain('时装');
    expect($data['options'])->toContain('食品');
});

test('lang 파라미터가 없으면 기본값 ko로 동작한다', function () {
    $response = $this->getJson('/api/categories/levels');

    $response->assertOk();
    $data = $response->json('data');
    expect($data['options'])->toContain('패션의류');
});

test('잘못된 lang 값이면 400을 반환한다', function () {
    $response = $this->getJson('/api/categories/levels?'.http_build_query(['lang' => 'jp']));

    $response->assertStatus(400);
});
```

- [ ] **Step 3: 테스트 실행 — 빨간색 확인**

```bash
cd /var/app/www/cl_embed && docker exec cl_embed_laravel php artisan test --filter="CategoryLevelsTest"
```

예상: lang 관련 새 테스트 5개 실패 (아직 미구현)

---

### Task 2: 백엔드 — `CategoryController::levels()` 언어 파라미터 구현

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php:363-529`

- [ ] **Step 1: `lang` 파라미터 검증 및 컬럼 변수 추가**

`levels()` 메서드의 `$maxDepthSetting` 줄 다음에 다음 코드를 추가한다:

```php
// 언어 파라미터 검증
$lang = $request->query('lang', 'ko');
if (! in_array($lang, ['ko', 'en', 'zh'], true)) {
    return response()->json(['message' => 'lang must be one of: ko, en, zh'], 400);
}
$langColumn = 'category_name_'.$lang;
```

- [ ] **Step 2: `$dbMaxDepth` 계산에서 `$langColumn` 사용**

기존 코드 (line 420):
```php
$dbMaxDepth = (int) (clone $scopeQuery)->selectRaw('max(array_length(string_to_array(category_name_ko, \'>\'), 1))')->value('max') ?? 1;
```

변경:
```php
$dbMaxDepth = (int) (clone $scopeQuery)->selectRaw('max(array_length(string_to_array('.$langColumn.', \'>\'), 1))')->value('max') ?? 1;
```

- [ ] **Step 3: 접두사 필터링에서 `$langColumn` 사용**

기존 코드 (line 427):
```php
$query->where('category_name_ko', 'like', $prefix.'%');
```

변경:
```php
$query->where($langColumn, 'like', $prefix.'%');
```

- [ ] **Step 4: max_depth 초과 블록의 select/map에서 `$langColumn` 사용**

기존 코드 (lines 433-438):
```php
$categories = $query
    ->select('id', 'category_code', 'category_name_ko')
    ->get();

$options = $categories
    ->map(function ($c) use ($currentDepth) {
        $parts = explode('>', $c->category_name_ko);
```

변경:
```php
$categories = $query
    ->select('id', 'category_code', $langColumn)
    ->get();

$options = $categories
    ->map(function ($c) use ($currentDepth, $langColumn) {
        $parts = explode('>', $c->{$langColumn});
```

- [ ] **Step 5: 현재 깊이 옵션 추출 블록에서 `$langColumn` 사용**

기존 코드 (lines 464-470):
```php
$options = $query
    ->select('category_name_ko')
    ->get()
    ->map(function ($c) use ($nextDepthIndex) {
        $parts = explode('>', $c->category_name_ko);
```

변경:
```php
$options = $query
    ->select($langColumn)
    ->get()
    ->map(function ($c) use ($nextDepthIndex, $langColumn) {
        $parts = explode('>', $c->{$langColumn});
```

- [ ] **Step 6: 리프 확인 블록에서 `$langColumn` 사용**

기존 코드 (lines 484, 487):
```php
$leafCategory = (clone $scopeQuery)->where('category_name_ko', $leafPath)->first();
$categoryCount = (clone $scopeQuery)->where('category_name_ko', $leafPath)->count();
```

변경:
```php
$leafCategory = (clone $scopeQuery)->where($langColumn, $leafPath)->first();
$categoryCount = (clone $scopeQuery)->where($langColumn, $leafPath)->count();
```

- [ ] **Step 7: 더 깊은 카테고리 블록에서 `$langColumn` 사용**

기존 코드 (lines 493-501):
```php
$deeperCategories = $deeperQuery
    ->where('category_name_ko', 'like', $deeperPrefix.'%')
    ->select('id', 'category_code', 'category_name_ko')
    ->get();

if ($deeperCategories->isNotEmpty()) {
    $options = $deeperCategories
        ->map(function ($c) use ($currentDepth) {
            $parts = explode('>', $c->category_name_ko);
```

변경:
```php
$deeperCategories = $deeperQuery
    ->where($langColumn, 'like', $deeperPrefix.'%')
    ->select('id', 'category_code', $langColumn)
    ->get();

if ($deeperCategories->isNotEmpty()) {
    $options = $deeperCategories
        ->map(function ($c) use ($currentDepth, $langColumn) {
            $parts = explode('>', $c->{$langColumn});
```

- [ ] **Step 8: 테스트 실행 — 초록색 확인**

```bash
cd /var/app/www/cl_embed && docker exec cl_embed_laravel php artisan test --filter="CategoryLevelsTest"
```

예상: 전체 통과

- [ ] **Step 9: 커밋**

```bash
cd /var/app/www/cl_embed && git add laravel/app/Http/Controllers/Api/CategoryController.php laravel/tests/Feature/Api/CategoryLevelsTest.php
git commit -m "feat: categories/levels API에 lang 파라미터 지원 (ko/en/zh)"
```

---

### Task 3: 프론트엔드 — `embed-params.ts`에 `hierarchyLang` 추가

**Files:**
- Modify: `nextjs/lib/embed-params.ts`

- [ ] **Step 1: `EmbedParams` interface에 `hierarchyLang` 필드 추가**

기존 코드 (line 20-21):
```typescript
  /** 유사도 검색 언어 (기본 ko) */
  searchLang: string;
```

다음 줄에 추가:
```typescript
  /** 분류선택 계층 언어 (기본 ko) */
  hierarchyLang: string;
```

- [ ] **Step 2: `parseEmbedParams()`에서 `lang` 파라미터 읽기**

기존 코드 (line 55-56):
```typescript
  const slang = params.get("slang");
  const searchLang = slang === "en" || slang === "zh" ? slang : "ko";
```

다음 줄에 추가:
```typescript
  const langParam = params.get("lang");
  const hierarchyLang = langParam === "en" || langParam === "zh" ? langParam : "ko";
```

- [ ] **Step 3: 반환 객체에 `hierarchyLang` 추가**

기존 코드 (line 61):
```typescript
  return { mode, keyword, filter, searchText, searchLang, catPath, folder, userId };
```

변경:
```typescript
  return { mode, keyword, filter, searchText, searchLang, hierarchyLang, catPath, folder, userId };
```

- [ ] **Step 4: tsc 확인**

```bash
cd /var/app/www/cl_embed && docker exec cl_embed_nextjs npx tsc --noEmit 2>&1 | head -30
```

예상: `hierarchyLang` 미사용 경고만 있고 에러 없음

- [ ] **Step 5: 커밋**

```bash
cd /var/app/www/cl_embed && git add nextjs/lib/embed-params.ts
git commit -m "feat: embed-params에 hierarchyLang (lang URL 파라미터) 추가"
```

---

### Task 4: 프론트엔드 — `CategoryHierarchy`에 언어 radio button 추가

**Files:**
- Modify: `nextjs/components/admin/category-hierarchy.tsx`

- [ ] **Step 1: Props에 `lang`과 `onLangChange` 추가**

기존 `CategoryHierarchyProps` interface (line 33-34):
```typescript
  token?: string | null;
  folder?: string | null;
```

다음 줄에 추가:
```typescript
  /** 분류선택 계층 언어 */
  lang?: string;
  /** 언어 변경 콜백 */
  onLangChange?: (lang: string) => void;
```

- [ ] **Step 2: destructuring에 `lang`과 `onLangChange` 추가**

기존 (line 60-63):
```typescript
  token,
  folder,
  userId,
}: CategoryHierarchyProps) {
```

변경:
```typescript
  token,
  folder,
  userId,
  lang = "ko",
  onLangChange,
}: CategoryHierarchyProps) {
```

- [ ] **Step 3: `fetchCategoryLevels` 호출 시 `lang` 파라미터 전달 — refreshKey effect**

기존 (line 86-89):
```typescript
      const params: Record<string, string> = {};
      if (folder) params["folder"] = folder;
      if (userId) params["user_id"] = String(userId);
      fetchCategoryLevels(Object.keys(params).length > 0 ? params : undefined, token, userId ?? undefined)
```

변경:
```typescript
      const params: Record<string, string> = {};
      if (lang !== "ko") params["lang"] = lang;
      if (folder) params["folder"] = folder;
      if (userId) params["user_id"] = String(userId);
      fetchCategoryLevels(Object.keys(params).length > 0 ? params : undefined, token, userId ?? undefined)
```

- [ ] **Step 4: `fetchCategoryLevels` 호출 시 `lang` 파라미터 전달 — resetKey effect**

기존 (line 110-113):
```typescript
      const params: Record<string, string> = {};
      if (folder) params["folder"] = folder;
      if (userId) params["user_id"] = String(userId);
      fetchCategoryLevels(Object.keys(params).length > 0 ? params : undefined, token, userId ?? undefined)
```

변경:
```typescript
      const params: Record<string, string> = {};
      if (lang !== "ko") params["lang"] = lang;
      if (folder) params["folder"] = folder;
      if (userId) params["user_id"] = String(userId);
      fetchCategoryLevels(Object.keys(params).length > 0 ? params : undefined, token, userId ?? undefined)
```

- [ ] **Step 5: `fetchCategoryLevels` 호출 시 `lang` 파라미터 전달 — 복원 effect (line 130-134)**

기존 (line 130-134):
```typescript
      for (let i = 0; i < path.length; i++) {
        const catParams: Record<string, string> = {};
        for (let j = 0; j <= i; j++) {
          catParams[`cat${j + 1}`] = path[j];
        }
        fetchCategoryLevels(catParams as Parameters<typeof fetchCategoryLevels>[0], token ?? undefined, userId ?? undefined)
```

변경:
```typescript
      for (let i = 0; i < path.length; i++) {
        const catParams: Record<string, string> = {};
        if (lang !== "ko") catParams["lang"] = lang;
        for (let j = 0; j <= i; j++) {
          catParams[`cat${j + 1}`] = path[j];
        }
        fetchCategoryLevels(catParams as Parameters<typeof fetchCategoryLevels>[0], token ?? undefined, userId ?? undefined)
```

- [ ] **Step 6: `fetchCategoryLevels` 호출 시 `lang` 파라미터 전달 — handleLevelChange (line 190-197)**

기존 (line 190-197):
```typescript
        const catParams: Record<string, string> = {};
        const nonNullPath = newPath.filter((v): v is string => v !== null);
        for (let i = 0; i < nonNullPath.length; i++) {
          catParams[`cat${i + 1}`] = nonNullPath[i];
        }
        if (folder) catParams["folder"] = folder;
        if (userId) catParams["user_id"] = String(userId);
        const res = await fetchCategoryLevels(catParams as Parameters<typeof fetchCategoryLevels>[0], token, userId ?? undefined);
```

변경:
```typescript
        const catParams: Record<string, string> = {};
        if (lang !== "ko") catParams["lang"] = lang;
        const nonNullPath = newPath.filter((v): v is string => v !== null);
        for (let i = 0; i < nonNullPath.length; i++) {
          catParams[`cat${i + 1}`] = nonNullPath[i];
        }
        if (folder) catParams["folder"] = folder;
        if (userId) catParams["user_id"] = String(userId);
        const res = await fetchCategoryLevels(catParams as Parameters<typeof fetchCategoryLevels>[0], token, userId ?? undefined);
```

- [ ] **Step 7: `handleLevelChange` useCallback 의존성 배열에 `lang` 추가**

기존 (line 223):
```typescript
    [selectedPath, onKeywordSearch, filterMode, keywordText, reportFilterChange, token, onSelectLeafPath]
```

변경:
```typescript
    [selectedPath, onKeywordSearch, filterMode, keywordText, reportFilterChange, token, onSelectLeafPath, lang, folder, userId]
```

- [ ] **Step 8: 언어 변경 핸들러 추가**

`handleHierarchyReset` useCallback 다음에 다음 코드를 추가한다:

```typescript
  const handleLangChange = useCallback(
    async (newLang: string) => {
      if (newLang === lang) return;
      onLangChange?.(newLang);
      // 모든 드롭다운 초기화
      setSelectedPath([]);
      setLevelOptions([]);
      setLoadingStates([]);
      setKeywordText("");
      onKeywordSearch("");
      reportFilterChange("hierarchy", [], "");
      // 새 언어로 최상위 옵션 재조회
      const params: Record<string, string> = {};
      if (newLang !== "ko") params["lang"] = newLang;
      if (folder) params["folder"] = folder;
      if (userId) params["user_id"] = String(userId);
      try {
        const res = await fetchCategoryLevels(Object.keys(params).length > 0 ? params : undefined, token, userId ?? undefined);
        setLevelOptions([res.data.options]);
        setMaxDepth(res.data.maxDepth);
      } catch {}
    },
    [lang, onLangChange, onKeywordSearch, reportFilterChange, token, folder, userId]
  );
```

- [ ] **Step 9: 언어 radio button UI 추가 — 분류선택 모드에서만 표시**

`filterMode === "hierarchy"` 블록의 `<div className="space-y-2">` 내부, 첫 번째 `Array.from` 앞에 다음 코드를 추가한다:

```tsx
              {/* 언어 선택 radio button */}
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className={getPillButtonClass(lang === "ko")}
                  onClick={() => handleLangChange("ko")}
                  aria-pressed={lang === "ko"}
                >
                  한국어
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={getPillButtonClass(lang === "en")}
                  onClick={() => handleLangChange("en")}
                  aria-pressed={lang === "en"}
                >
                  영어
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={getPillButtonClass(lang === "zh")}
                  onClick={() => handleLangChange("zh")}
                  aria-pressed={lang === "zh"}
                >
                  중국어
                </Button>
              </div>
```

- [ ] **Step 10: tsc 확인**

```bash
cd /var/app/www/cl_embed && docker exec cl_embed_nextjs npx tsc --noEmit 2>&1 | head -30
```

예상: 에러 없음

- [ ] **Step 11: 커밋**

```bash
cd /var/app/www/cl_embed && git add nextjs/components/admin/category-hierarchy.tsx
git commit -m "feat: CategoryHierarchy에 분류선택 언어 radio button 추가"
```

---

### Task 5: 프론트엔드 — `EmbedPageInner`에서 `hierarchyLang` 상태 관리

**Files:**
- Modify: `nextjs/app/embed/embed-page-inner.tsx`

- [ ] **Step 1: props에 `serverHierarchyLang` 추가**

기존 props interface (line 116):
```typescript
  serverSearchLang: string;
```

다음 줄에 추가:
```typescript
  serverHierarchyLang?: string;
```

- [ ] **Step 2: destructuring에 `serverHierarchyLang` 추가**

기존 (line 99):
```typescript
  serverSearchLang,
```

다음 줄에 추가:
```typescript
  serverHierarchyLang,
```

- [ ] **Step 3: `hierarchyLang` 상태 선언**

`searchLanguage` 상태 선언 다음에 추가 (line 189 근처):
```typescript
  const [hierarchyLang, setHierarchyLang] = useState(serverHierarchyLang ?? embedParams.hierarchyLang ?? "ko");
```

- [ ] **Step 4: `updateURL()`에 `hierarchyLang` 오버라이드 추가**

`updateURL`의 overrides 타입에 `hierarchyLang?: string` 추가 (line 258 근처):
```typescript
    hierarchyLang?: string;
```

`updateURL` 본체에 다음 로직 추가 (line 282 근처, `searchLanguage` 처리 다음):
```typescript
    if ("hierarchyLang" in overrides) {
      if (overrides.hierarchyLang && overrides.hierarchyLang !== "ko") params.set("lang", overrides.hierarchyLang);
      else params.delete("lang");
    }
```

- [ ] **Step 5: `CategoryHierarchy`에 `lang`과 `onLangChange` 전달**

기존 (line 704-725):
```tsx
            <CategoryHierarchy
              onSelectCategory={(categoryId) => {
```

`userId={selectedUserId}` 다음 줄에 추가:
```tsx
              lang={hierarchyLang}
              onLangChange={(lang) => {
                setHierarchyLang(lang);
                updateURL({ hierarchyLang: lang });
              }}
```

- [ ] **Step 6: `resetToDefault()`에 `hierarchyLang` 초기화 포함 확인**

`resetToDefault` 함수에서 `hierarchyLang`도 초기화되어야 한다. 해당 함수를 찾아 `setHierarchyLang("ko")`가 포함되어 있는지 확인하고, 없으면 추가한다.

- [ ] **Step 7: tsc 확인**

```bash
cd /var/app/www/cl_embed && docker exec cl_embed_nextjs npx tsc --noEmit 2>&1 | head -30
```

예상: 에러 없음

- [ ] **Step 8: 커밋**

```bash
cd /var/app/www/cl_embed && git add nextjs/app/embed/embed-page-inner.tsx
git commit -m "feat: EmbedPageInner에 hierarchyLang 상태 관리 및 CategoryHierarchy 연동"
```

---

### Task 6: SSR — `page.tsx`에서 `hierarchyLang` 프리페치

**Files:**
- Modify: `nextjs/app/embed/page.tsx`

- [ ] **Step 1: `parseEmbedParams`에서 `hierarchyLang` 추출**

기존 (line 26):
```typescript
  const { keyword, searchText, searchLang, filter: urlFilter, folder: urlFolder, userId: urlUserId } = parseEmbedParams(reader);
```

변경:
```typescript
  const { keyword, searchText, searchLang, hierarchyLang, filter: urlFilter, folder: urlFolder, userId: urlUserId } = parseEmbedParams(reader);
```

- [ ] **Step 2: `fetchCategoryLevels()` 호출 시 `lang` 파라미터 전달**

기존 (line 63-65):
```typescript
    const topParams: Record<string, string> = {};
    if (urlFolder) topParams["folder"] = urlFolder;
    const topRes = await fetchCategoryLevels(Object.keys(topParams).length > 0 ? topParams : undefined, token, urlUserIdNum);
```

변경:
```typescript
    const topParams: Record<string, string> = {};
    if (hierarchyLang !== "ko") topParams["lang"] = hierarchyLang;
    if (urlFolder) topParams["folder"] = urlFolder;
    const topRes = await fetchCategoryLevels(Object.keys(topParams).length > 0 ? topParams : undefined, token, urlUserIdNum);
```

- [ ] **Step 3: 후속 depth 프리페치에도 `lang` 전달**

기존 (line 81-86):
```typescript
    for (let i = 0; i < catPath.length && i < maxDepth - 1; i++) {
      const catParams: Record<string, string> = {};
      for (let j = 0; j <= i; j++) {
        catParams[`cat${j + 1}`] = catPath[j];
      }
      if (urlFolder) catParams["folder"] = urlFolder;
```

변경:
```typescript
    for (let i = 0; i < catPath.length && i < maxDepth - 1; i++) {
      const catParams: Record<string, string> = {};
      if (hierarchyLang !== "ko") catParams["lang"] = hierarchyLang;
      for (let j = 0; j <= i; j++) {
        catParams[`cat${j + 1}`] = catPath[j];
      }
      if (urlFolder) catParams["folder"] = urlFolder;
```

- [ ] **Step 4: `serverHierarchyLang` prop 전달**

기존 (line 131-150)의 `<EmbedPageInner`에 다음 prop 추가:
```tsx
        serverHierarchyLang={hierarchyLang}
```

- [ ] **Step 5: tsc 확인**

```bash
cd /var/app/www/cl_embed && docker exec cl_embed_nextjs npx tsc --noEmit 2>&1 | head -30
```

예상: 에러 없음

- [ ] **Step 6: 커밋**

```bash
cd /var/app/www/cl_embed && git add nextjs/app/embed/page.tsx
git commit -m "feat: SSR에서 hierarchyLang 파라미터 읽어 계층 프리페치에 전달"
```

---

### Task 7: `slang` URL 즉시 반영 수정

**Files:**
- Modify: `nextjs/app/embed/embed-page-inner.tsx`

- [ ] **Step 1: 유사도 검색 radio button에 `updateURL` 호출 추가**

기존 (lines 597-618):
```tsx
                  <Button
                    size="sm"
                    variant="outline"
                    className={getPillButtonClass(searchLanguage === "ko")}
                    onClick={() => setSearchLanguage("ko")}
                    aria-pressed={searchLanguage === "ko"}
                  >
                    한국어
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={getPillButtonClass(searchLanguage === "en")}
                    onClick={() => setSearchLanguage("en")}
                    aria-pressed={searchLanguage === "en"}
                  >
                    영어
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={getPillButtonClass(searchLanguage === "zh")}
                    onClick={() => setSearchLanguage("zh")}
                    aria-pressed={searchLanguage === "zh"}
                  >
                    중국어
                  </Button>
```

변경:
```tsx
                  <Button
                    size="sm"
                    variant="outline"
                    className={getPillButtonClass(searchLanguage === "ko")}
                    onClick={() => { setSearchLanguage("ko"); updateURL({ searchLanguage: "ko" }); }}
                    aria-pressed={searchLanguage === "ko"}
                  >
                    한국어
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={getPillButtonClass(searchLanguage === "en")}
                    onClick={() => { setSearchLanguage("en"); updateURL({ searchLanguage: "en" }); }}
                    aria-pressed={searchLanguage === "en"}
                  >
                    영어
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={getPillButtonClass(searchLanguage === "zh")}
                    onClick={() => { setSearchLanguage("zh"); updateURL({ searchLanguage: "zh" }); }}
                    aria-pressed={searchLanguage === "zh"}
                  >
                    중국어
                  </Button>
```

- [ ] **Step 2: tsc 확인**

```bash
cd /var/app/www/cl_embed && docker exec cl_embed_nextjs npx tsc --noEmit 2>&1 | head -30
```

예상: 에러 없음

- [ ] **Step 3: 커밋**

```bash
cd /var/app/www/cl_embed && git add nextjs/app/embed/embed-page-inner.tsx
git commit -m "feat: 유사도 검색 언어 radio toggle 시 slang URL 파라미터 즉시 반영"
```

---

### Task 8: 전체 검증 — Playwright 테스트 및 lint

**Files:**
- Test: 전체 빌드 및 린트 확인

- [ ] **Step 1: 백엔드 테스트 전체 실행**

```bash
cd /var/app/www/cl_embed && docker exec cl_embed_laravel php artisan test --filter="CategoryLevelsTest"
```

예상: 전체 통과

- [ ] **Step 2: 프론트엔드 tsc 확인**

```bash
cd /var/app/www/cl_embed && docker exec cl_embed_nextjs npx tsc --noEmit 2>&1 | head -30
```

예상: 에러 없음

- [ ] **Step 3: 프론트엔드 lint 확인**

```bash
cd /var/app/www/cl_embed && docker exec cl_embed_nextjs npx eslint app/embed/embed-page-inner.tsx components/admin/category-hierarchy.tsx lib/embed-params.ts --max-warnings=0 2>&1 | tail -20
```

예상: 경고/에러 없음

- [ ] **Step 4: Playwright — 분류선택 언어 변경 동작 확인**

브라우저에서 `https://embed.cunlim.dev` 접속 후:
1. 분류선택 필터에서 "영어" radio 클릭 → 드롭다운이 영어 옵션으로 변경되는지 확인
2. URL에 `lang=en` 파라미터가 추가되는지 확인
3. 페이지 새로고침 → 영어 계층이 SSR로 로드되는지 확인
4. 한국어 radio 클릭 → 드롭다운 초기화 + 한국어 옵션 로드 확인
5. URL에서 `lang` 파라미터가 제거되는지 확인 (기본값이므로)

- [ ] **Step 5: Playwright — 유사도 검색 언어 URL 즉시 반영 확인**

1. 유사도 검색에서 "영어" radio 클릭 → URL에 `slang=en`이 즉시 추가되는지 확인
2. 검색어 입력 없이 새로고침 → `slang=en`이 유지되는지 확인
3. 한국어 radio 클릭 → `slang` 파라미터가 URL에서 제거되는지 확인

- [ ] **Step 6: `.claude/hooks/run-all-checks.sh` 실행**

```bash
cd /var/app/www/cl_embed && bash .claude/hooks/run-all-checks.sh
```

예상: tsc, lint, test, pint 모두 EXIT=0

- [ ] **Step 7: 최종 커밋 (필요 시 수정)**

```bash
cd /var/app/www/cl_embed && git add -A && git status
```

변경사항이 있으면 커밋:
```bash
git commit -m "fix: lint/tsc 이슈 수정"
```
