# 동적 카테고리 깊이 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카테고리 필터의 대/중/소/세 4단계 고정 제한을 제거하고, DB에서 실시간으로 계산한 최대 깊이만큼 동적으로 필터를 생성한다.

**Architecture:** 백엔드 `levels()` API를 catN 파라미터 기반으로 재작성하여 임의 깊이를 지원하고, `maxDepth`를 DB 설정(`category.max_depth`)과 접근 가능한 카테고리의 실제 깊이 중 작은 값으로 결정한다. 프론트엔드는 `maxDepth`만큼 Select를 동적으로 렌더링한다.

**Tech Stack:** Laravel 12 (PHP 8.4), Next.js 16 (React 19, TypeScript 5), shadcn/ui Select, PostgreSQL + pgvector

---

## File Structure

### 백엔드 (Laravel)

| 파일 | 작업 | 역할 |
|------|------|------|
| `laravel/config/services.php:87-91` | 수정 | `category.max_depth` 기본값(10) 추가 |
| `laravel/database/seeders/SettingsSeeder.php:133-159` | 수정 | `category.max_depth` 설정 항목 추가 |
| `laravel/app/Http/Controllers/Api/CategoryController.php:103-235` | 전면 수정 | `levels()` 메서드를 catN 기반 동적 로직으로 재작성 |
| `laravel/tests/Feature/CategoryApiTest.php` | 수정 | levels API 신규 테스트 추가 |

### 프론트엔드 (Next.js)

| 파일 | 작업 | 역할 |
|------|------|------|
| `nextjs/lib/api.ts:182-209` | 수정 | `CategoryLevelsParams`, `CategoryLevelsResponse`, `fetchCategoryLevels` 변경 |
| `nextjs/lib/category.ts` | 전면 수정 | `HierarchyLevel` 제거, `parseHierarchy`를 배열 기반으로 변경 |
| `nextjs/lib/embed-params.ts:26-53` | 수정 | catN 동적 파싱 |
| `nextjs/components/admin/category-hierarchy.tsx` | 전면 수정 | 동적 Select 생성, 배열 기반 상태 |
| `nextjs/app/embed/page.tsx` | 수정 | SSR prefetch 로직 변경 |
| `nextjs/app/embed/embed-page-inner.tsx` | 수정 | props/state 구조 변경 |
| `nextjs/app/page.tsx:19` | 수정 | "4단계 계층 필터링" 텍스트 변경 |
| `nextjs/lib/__tests__/api.test.ts:247-273` | 수정 | fetchCategoryLevels 테스트 변경 |
| `nextjs/lib/__tests__/category.test.ts` | 전면 수정 | parseHierarchy 테스트 변경 |
| `nextjs/app/embed/__tests__/page.test.tsx` | 수정 | EmbedPageInner props 변경 반영 |

---

### Task 1: 백엔드 — `category.max_depth` 설정 추가

**Files:**
- Modify: `laravel/config/services.php:87-91`
- Modify: `laravel/database/seeders/SettingsSeeder.php:133-159`

- [ ] **Step 1: config/services.php에 max_depth 기본값 추가**

`laravel/config/services.php`의 `category` 배열에 `max_depth` 키를 추가한다.

```php
'category' => [
    'code_prefix' => 'CAT_',
    'code_random_length' => 8,
    'code_max_attempts' => 3,
    'max_depth' => 10,
],
```

- [ ] **Step 2: SettingsSeeder에 max_depth 항목 추가**

`laravel/database/seeders/SettingsSeeder.php`의 category 섹션 마지막(`code_max_attempts` 항목 뒤)에 다음을 추가한다.

```php
Setting::firstOrCreate(
    ['group' => 'category', 'key' => 'max_depth'],
    [
        'value' => '10',
        'type' => 'integer',
        'description' => '필터로 노출할 최대 카테고리 깊이',
    ]
);
```

- [ ] **Step 3: Seeder 실행하여 DB에 반영**

```bash
docker exec cl_embed_laravel php artisan db:seed --class=SettingsSeeder
```

Expected: `category.max_depth` 설정이 settings 테이블에 추가됨.

- [ ] **Step 4: Commit**

```bash
git add laravel/config/services.php laravel/database/seeders/SettingsSeeder.php
git commit -m "feat: category.max_depth 설정 추가"
```

---

### Task 2: 백엔드 — `levels()` API 재작성

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php:103-235`

- [ ] **Step 1: levels 메서드 전면 교체**

`CategoryController::levels()` 메서드를 다음 코드로 전면 교체한다. 기존 `대/중/소/세` 파라미터 로직을 제거하고, catN 파라미터 기반 동적 로직으로 재작성한다.

```php
public function levels(Request $request): JsonResponse
{
    $user = $request->user('sanctum');
    $maxDepthSetting = (int) config('services.category.max_depth', 10);

    // catN 파라미터 추출 (cat1, cat2, cat3, ...)
    $prefixParts = [];
    for ($i = 1; $i <= 20; $i++) {
        $key = 'cat' . $i;
        if ($request->has($key) && $request->input($key) !== '') {
            $prefixParts[] = $request->input($key);
        } else {
            break;
        }
    }

    // 기존 대/중/소/세 파라미터 하위 호환 (deprecated)
    if (empty($prefixParts)) {
        $legacyKeys = ['대', '중', '소'];
        foreach ($legacyKeys as $key) {
            $val = $request->query($key);
            if ($val !== null && $val !== '') {
                $prefixParts[] = $val;
            } else {
                break;
            }
        }
    }

    $currentDepth = count($prefixParts); // 0이면 최상위 목록

    // 접근 가능한 카테고리 쿼리 (user scope 규칙 적용)
    $scopeQuery = Category::query();
    if ($user && $user->isAdmin()) {
        // admin/superadmin: no restriction
    } elseif ($user) {
        $scopeQuery->whereIn('user_id', [$user->id, 1]);
    } else {
        $scopeQuery->where('user_id', 1);
    }

    // maxDepth 계산: min(DB실제최대깊이, 설정값)
    $dbMaxDepth = (int) $scopeQuery->selectRaw('max(array_length(string_to_array(category_name_ko, \'>\'), 1))')->value('max') ?? 1;
    $maxDepth = min($dbMaxDepth, $maxDepthSetting);

    // prefix로 필터링
    $query = clone $scopeQuery;
    if (!empty($prefixParts)) {
        $prefix = implode('>', $prefixParts) . '>';
        $query->where('category_name_ko', 'like', $prefix . '%');
    }

    // 현재 depth의 고유 옵션 추출
    $nextDepthIndex = $currentDepth; // 0-based 인덱스
    $options = $query
        ->select('category_name_ko')
        ->get()
        ->map(function ($c) use ($nextDepthIndex) {
            $parts = explode('>', $c->category_name_ko);
            return isset($parts[$nextDepthIndex]) ? trim($parts[$nextDepthIndex]) : null;
        })
        ->filter(fn ($s) => $s !== null && $s !== '')
        ->unique()
        ->values()
        ->toArray();

    // 리프 카테고리 확인
    $isLeaf = empty($options);
    $leafCategoryId = null;

    if ($isLeaf && !empty($prefixParts)) {
        $leafPath = implode('>', $prefixParts);
        $leafCategory = $scopeQuery->where('category_name_ko', $leafPath)->first();
        $leafCategoryId = $leafCategory?->id;

        // 초과 깊이 처리: prefix로 시작하는 더 깊은 카테고리가 있으면,
        // 마지막 단계에 하위 경로를 포함한 옵션을 생성
        if ($leafCategoryId === null) {
            $deeperQuery = clone $scopeQuery;
            $deeperPrefix = implode('>', $prefixParts) . '>';
            $deeperCategories = $deeperQuery
                ->where('category_name_ko', 'like', $deeperPrefix . '%')
                ->select('id', 'category_code', 'category_name_ko')
                ->get();

            if ($deeperCategories->isNotEmpty()) {
                $options = $deeperCategories
                    ->map(function ($c) use ($currentDepth) {
                        $parts = explode('>', $c->category_name_ko);
                        // 현재 depth부터 나머지 전체를 하나의 옵션으로
                        $remaining = array_slice($parts, $currentDepth);
                        return [
                            'label' => implode(' > ', array_map('trim', $remaining)),
                            'categoryId' => $c->id,
                            'categoryCode' => $c->category_code,
                        ];
                    })
                    ->unique('label')
                    ->values()
                    ->toArray();

                $isLeaf = false;
            }
        }
    }

    return response()->json([
        'data' => [
            'options' => $options,
            'maxDepth' => $maxDepth,
            'isLeaf' => $isLeaf,
            'leafCategoryId' => $leafCategoryId,
        ],
    ]);
}
```

- [ ] **Step 2: Pint 코드 포맷팅**

```bash
docker exec cl_embed_laravel vendor/bin/pint --format agent
```

- [ ] **Step 3: Commit**

```bash
git add laravel/app/Http/Controllers/Api/CategoryController.php
git commit -m "feat: levels API를 catN 파라미터 기반 동적 로직으로 재작성"
```

---

### Task 3: 백엔드 — levels API 테스트

**Files:**
- Modify: `laravel/tests/Feature/CategoryApiTest.php`

- [ ] **Step 1: levels API 테스트 추가**

`CategoryApiTest.php` 파일 끝에 다음 테스트들을 추가한다.

```php
test('GET /api/categories/levels — 파라미터 없이 대 목록을 반환한다', function () {
    Category::factory()->create(['category_name_ko' => '패션의류>여성의류>원피스']);
    Category::factory()->create(['category_name_ko' => '전자기기>스마트폰']);

    $response = $this->getJson('/api/categories/levels');

    $response->assertOk()
        ->assertJsonPath('data.options', ['패션의류', '전자기기'])
        ->assertJsonPath('data.maxDepth', 3)
        ->assertJsonPath('data.isLeaf', false);
});

test('GET /api/categories/levels — cat1 파라미터로 중 목록을 반환한다', function () {
    Category::factory()->create(['category_name_ko' => '패션의류>여성의류>원피스']);
    Category::factory()->create(['category_name_ko' => '패션의류>남성의류>셔츠']);

    $response = $this->getJson('/api/categories/levels?cat1=' . urlencode('패션의류'));

    $response->assertOk()
        ->assertJsonPath('data.options', ['여성의류', '남성의류']);
});

test('GET /api/categories/levels — cat1+cat2 파라미터로 소 목록을 반환한다', function () {
    Category::factory()->create(['category_name_ko' => '패션의류>여성의류>원피스']);
    Category::factory()->create(['category_name_ko' => '패션의류>여성의류>블라우스']);

    $response = $this->getJson('/api/categories/levels?cat1=' . urlencode('패션의류') . '&cat2=' . urlencode('여성의류'));

    $response->assertOk()
        ->assertJsonPath('data.options', ['원피스', '블라우스']);
});

test('GET /api/categories/levels — 리프 카테고리일 때 leafCategoryId를 반환한다', function () {
    $cat = Category::factory()->create(['category_name_ko' => '패션의류>여성의류>원피스']);

    $response = $this->getJson('/api/categories/levels?cat1=' . urlencode('패션의류') . '&cat2=' . urlencode('여성의류') . '&cat3=' . urlencode('원피스'));

    $response->assertOk()
        ->assertJsonPath('data.isLeaf', true)
        ->assertJsonPath('data.leafCategoryId', $cat->id);
});

test('GET /api/categories/levels — max_depth 설정을 초과하는 깊이는 lastSegment로 포함한다', function () {
    // max_depth를 3으로 설정
    \App\Models\Setting::updateOrCreate(
        ['group' => 'category', 'key' => 'max_depth'],
        ['value' => '3', 'type' => 'integer', 'description' => 'test']
    );

    Category::factory()->create(['category_name_ko' => 'A>B>C>D>E']);

    $response = $this->getJson('/api/categories/levels?cat1=A&cat2=B');

    $response->assertOk();
    $options = $response->json('data.options');
    // 3단계(depth 2)에서의 옵션: C>D>E 형태로 표시
    expect($options)->toBe(['C>D>E']);
});

test('GET /api/categories/levels — 비로그인 사용자는 user_id=1 카테고리만 본다', function () {
    Category::factory()->create(['category_name_ko' => '공개>카테고리', 'user_id' => 1]);
    Category::factory()->create(['category_name_ko' => '비공개>카테고리', 'user_id' => 2]);

    $response = $this->getJson('/api/categories/levels');

    $response->assertOk()
        ->assertJsonPath('data.options', ['공개']);
});

test('GET /api/categories/levels — 기존 대 파라미터로 하위 호환 동작한다', function () {
    Category::factory()->create(['category_name_ko' => '패션의류>여성의류>원피스']);

    $response = $this->getJson('/api/categories/levels?' . http_build_query(['대' => '패션의류']));

    $response->assertOk()
        ->assertJsonPath('data.options', ['여성의류']);
});
```

- [ ] **Step 2: 테스트 실행**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter="levels"
```

Expected: 모든 테스트 PASS.

- [ ] **Step 3: Commit**

```bash
git add laravel/tests/Feature/CategoryApiTest.php
git commit -m "test: levels API 동적 깊이 테스트 추가"
```

---

### Task 4: 프론트엔드 — API 타입 및 클라이언트 변경

**Files:**
- Modify: `nextjs/lib/api.ts:182-209`

- [ ] **Step 1: CategoryLevelsParams, CategoryLevelsResponse, fetchCategoryLevels 변경**

`nextjs/lib/api.ts`에서 기존 levels 관련 코드를 찾아 교체한다.

기존 코드 (삭제):
```typescript
export interface CategoryLevelsParams {
  대?: string;
  중?: string;
  소?: string;
}

export interface CategoryLevelsResponse {
  대?: string[];
  중?: string[];
  소?: string[];
  세?: { 세: string; categoryId: number; categoryCode: string }[];
  leafCategoryId?: number | null;
}

export function fetchCategoryLevels(
  params?: CategoryLevelsParams,
  token?: string | null
): Promise<{ data: CategoryLevelsResponse }> {
  const searchParams = new URLSearchParams();
  if (params?.대) searchParams.set("대", params.대);
  if (params?.중) searchParams.set("중", params.중);
  if (params?.소) searchParams.set("소", params.소);
  const qs = searchParams.toString();
  return request<{ data: CategoryLevelsResponse }>(
    `/categories/levels${qs ? "?" + qs : ""}`,
    { cache: "no-store", token }
  );
}
```

신규 코드 (삽입):
```typescript
export interface CategoryLevelsParams {
  cat1?: string;
  cat2?: string;
  cat3?: string;
  cat4?: string;
  cat5?: string;
  cat6?: string;
  cat7?: string;
  cat8?: string;
  cat9?: string;
  cat10?: string;
}

export interface CategoryLevelOption {
  label: string;
  categoryId: number;
  categoryCode: string;
}

export interface CategoryLevelsResponse {
  options: string[] | CategoryLevelOption[];
  maxDepth: number;
  isLeaf: boolean;
  leafCategoryId: number | null;
}

export function fetchCategoryLevels(
  params?: CategoryLevelsParams,
  token?: string | null
): Promise<{ data: CategoryLevelsResponse }> {
  const searchParams = new URLSearchParams();
  if (params?.cat1) searchParams.set("cat1", params.cat1);
  if (params?.cat2) searchParams.set("cat2", params.cat2);
  if (params?.cat3) searchParams.set("cat3", params.cat3);
  if (params?.cat4) searchParams.set("cat4", params.cat4);
  if (params?.cat5) searchParams.set("cat5", params.cat5);
  if (params?.cat6) searchParams.set("cat6", params.cat6);
  if (params?.cat7) searchParams.set("cat7", params.cat7);
  if (params?.cat8) searchParams.set("cat8", params.cat8);
  if (params?.cat9) searchParams.set("cat9", params.cat9);
  if (params?.cat10) searchParams.set("cat10", params.cat10);
  const qs = searchParams.toString();
  return request<{ data: CategoryLevelsResponse }>(
    `/categories/levels${qs ? "?" + qs : ""}`,
    { cache: "no-store", token }
  );
}
```

- [ ] **Step 2: TypeScript 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: 에러 없음 (기존 호출부에서 타입 에러 발생 가능 — 후속 Task에서 수정).

- [ ] **Step 3: Commit**

```bash
git add nextjs/lib/api.ts
git commit -m "feat: CategoryLevels API 타입을 catN 기반으로 변경"
```

---

### Task 5: 프론트엔드 — `category.ts` 변경

**Files:**
- Modify: `nextjs/lib/category.ts`

- [ ] **Step 1: HierarchyLevel 제거, parseHierarchy를 배열 기반으로 변경**

`nextjs/lib/category.ts` 전체를 다음으로 교체한다.

```typescript
import type { Category } from "@/lib/api";

/**
 * 카테고리 경로를 '>' 기준으로 분리하여 배열로 반환한다.
 * 예: "A>B>C" → ["A", "B", "C"]
 */
export function parseCategoryPath(categoryNameKo: string): string[] {
  return categoryNameKo.split(">").map((s) => s.trim()).filter((s) => s !== "");
}

/**
 * 카테고리 배열에서 각 카테고리의 깊이 경로를 파싱한다.
 */
export function parseHierarchy(categories: Category[]): { path: string[]; categoryId: number; categoryCode: string }[] {
  return categories
    .map((cat) => {
      const path = parseCategoryPath(cat.category_name_ko);
      if (path.length >= 1) {
        return {
          path,
          categoryId: cat.id,
          categoryCode: cat.category_code,
        };
      }
      return null;
    })
    .filter((h): h is { path: string[]; categoryId: number; categoryCode: string } => h !== null);
}
```

- [ ] **Step 2: Commit**

```bash
git add nextjs/lib/category.ts
git commit -m "refactor: HierarchyLevel 제거, 배열 기반 parseCategoryPath/parseHierarchy로 변경"
```

---

### Task 6: 프론트엔드 — `embed-params.ts` 변경

**Files:**
- Modify: `nextjs/lib/embed-params.ts:26-53`

- [ ] **Step 1: catN 동적 파싱 로직으로 변경**

`parseEmbedParams` 함수의 cat 파싱 부분을 다음으로 교체한다.

```typescript
export interface EmbedParams {
  mode: "hierarchy" | "search";
  /** hierarchy 키워드 ("A>B>C") 또는 검색 키워드 (q) */
  keyword: string | null;
  /** 전체/내카테고리 필터 */
  filter: string | undefined;
  /** 유사도 검색어 */
  searchText: string | null;
  /** 유사도 검색 언어 (기본 ko) */
  searchLang: string;
  /** URL에서 파싱된 계층 경로 배열 */
  catPath: string[];
}

export function parseEmbedParams(params: EmbedParamsReader): EmbedParams {
  const modeParam = params.get("mode");
  const mode = modeParam === "hierarchy" || modeParam === "search" ? modeParam : "hierarchy";

  // catN 파라미터 동적 파싱
  const catPath: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const val = params.get(`cat${i}`);
    if (val) {
      catPath.push(val);
    } else {
      break;
    }
  }

  let keyword: string | null = null;
  if (catPath.length > 0) {
    keyword = catPath.join(">");
  } else {
    keyword = params.get("q") || null;
  }

  const filterParam = params.get("filter");
  const filter = filterParam === "my" ? "my" : undefined;

  const searchText = params.get("stext") || null;
  const slang = params.get("slang");
  const searchLang = slang === "en" || slang === "zh" ? slang : "ko";

  return { mode, keyword, filter, searchText, searchLang, catPath };
}
```

- [ ] **Step 2: Commit**

```bash
git add nextjs/lib/embed-params.ts
git commit -m "refactor: embed-params catN 동적 파싱 + catPath 추가"
```

---

### Task 7: 프론트엔드 — `CategoryHierarchy` 컴포넌트 전면 수정

**Files:**
- Modify: `nextjs/components/admin/category-hierarchy.tsx`

- [ ] **Step 1: CategoryHierarchy 컴포넌트 전면 교체**

`category-hierarchy.tsx` 전체를 다음 코드로 교체한다. 핵심 변경:
- `HierarchyFilterState`를 `(string | null)[]` 배열로 변경
- `maxDepth`만큼 Select를 동적으로 생성
- 각 Select는 상위 선택 시 하위 옵션을 비동기 로드
- 상위 선택 변경 시 하위 Select 모두 초기화

```tsx
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchCategoryLevels, type CategoryLevelOption } from "@/lib/api";
import { Search, X, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** 인덱스 기반 계층 필터 상태. 인덱스가 depth, 값이 선택된 카테고리명. */
export type HierarchyFilterState = (string | null)[];

interface CategoryHierarchyProps {
  onSelectCategory: (categoryId: number) => void;
  onKeywordSearch: (keyword: string) => void;
  onSelectLeafPath?: (path: string[], categoryId?: number | null) => void;
  initialMode?: "hierarchy" | "search";
  initialHierarchy?: HierarchyFilterState;
  initialKeyword?: string;
  /** SSR prefetch 데이터: 각 depth별 옵션 배열 */
  initialLevelOptions: string[][];
  /** SSR prefetch에서 받은 maxDepth */
  initialMaxDepth: number;
  onFilterChange?: (state: {
    mode: "hierarchy" | "search";
    hierarchy: HierarchyFilterState;
    keyword: string;
  }) => void;
  refreshKey?: number;
  token?: string | null;
}

function getPillButtonClass(active: boolean): string {
  return cn(
    "h-7 rounded-full px-2.5 text-xs font-medium transition-colors",
    active
      ? "border border-primary/40 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
      : "border border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

export default function CategoryHierarchy({
  onSelectCategory,
  onKeywordSearch,
  initialMode = "hierarchy",
  initialHierarchy = [],
  initialKeyword = "",
  initialLevelOptions = [],
  initialMaxDepth = 1,
  onFilterChange,
  onSelectLeafPath,
  refreshKey = 0,
  token,
}: CategoryHierarchyProps) {
  const [filterMode, setFilterMode] = useState<"hierarchy" | "search">(initialMode);
  const [selectedPath, setSelectedPath] = useState<HierarchyFilterState>(initialHierarchy);
  const [keywordText, setKeywordText] = useState(initialKeyword);
  const [maxDepth, setMaxDepth] = useState(initialMaxDepth);

  // 각 depth별 옵션 상태
  const [levelOptions, setLevelOptions] = useState<(string[] | CategoryLevelOption[])[]>(initialLevelOptions);

  // 각 depth별 로딩 상태
  const [loadingStates, setLoadingStates] = useState<boolean[]>([]);

  // refreshKey 변경 시 최상위 옵션 다시 조회
  const prevTokenRef = useRef<string | null | undefined>(null);
  const hasRestoredRef = useRef(false);
  const hadInitialOptions = useRef(initialLevelOptions.length > 0 && initialLevelOptions[0].length > 0);

  useEffect(() => {
    const tokenChanged = token !== prevTokenRef.current;
    prevTokenRef.current = token;
    const skipInitial = hadInitialOptions.current;
    hadInitialOptions.current = false;
    if (token && (refreshKey > 0 || (tokenChanged && !skipInitial))) {
      fetchCategoryLevels(undefined, token).then((res) => {
        const opts = res.data.options;
        setLevelOptions([opts]);
        setMaxDepth(res.data.maxDepth);
      }).catch(() => {});
    }
  }, [refreshKey, token]);

  // 페이지 새로고침 시 초기 hierarchy 필터 복원
  useEffect(() => {
    if (hasRestoredRef.current) return;
    if (initialMode === "hierarchy" && initialHierarchy.length > 0 && initialHierarchy[0]) {
      hasRestoredRef.current = true;
      const path = initialHierarchy.filter((v): v is string => v !== null);
      onKeywordSearch(path.join(">"));

      // 각 depth에 대해 다음 옵션 로드
      for (let i = 0; i < path.length; i++) {
        const catParams: Record<string, string> = {};
        for (let j = 0; j <= i; j++) {
          catParams[`cat${j + 1}`] = path[j];
        }
        fetchCategoryLevels(catParams as Parameters<typeof fetchCategoryLevels>[0], token ?? undefined).then((res) => {
          const nextOpts = res.data.options;
          setLevelOptions((prev) => {
            const next = [...prev];
            next[i + 1] = nextOpts;
            return next;
          });
          if (res.data.isLeaf) {
            onSelectLeafPath?.(path.slice(0, i + 1), res.data.leafCategoryId);
          }
          if (res.data.maxDepth) {
            setMaxDepth(res.data.maxDepth);
          }
        }).catch(() => {});
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reportFilterChange = useCallback(
    (mode: "hierarchy" | "search", path: HierarchyFilterState, kw: string) => {
      onFilterChange?.({ mode, hierarchy: path, keyword: kw });
    },
    [onFilterChange]
  );

  const handleLevelChange = useCallback(
    async (depth: number, value: string) => {
      if (!value) {
        // 현재 depth부터 하위 모두 초기화
        const newPath = selectedPath.slice(0, depth);
        setSelectedPath(newPath);
        setLevelOptions((prev) => prev.slice(0, depth + 1));
        setLoadingStates((prev) => prev.slice(0, depth));

        const keyword = newPath.filter(Boolean).join(">");
        onKeywordSearch(keyword || "");
        reportFilterChange(filterMode, newPath, keywordText);
        return;
      }

      // 현재 depth 선택 + 하위 초기화
      const newPath = [...selectedPath.slice(0, depth), value];
      setSelectedPath(newPath);
      setLevelOptions((prev) => prev.slice(0, depth + 1));
      setLoadingStates((prev) => {
        const next = [...prev];
        next[depth] = true;
        return next;
      });

      const keyword = newPath.join(">");
      onKeywordSearch(keyword);
      reportFilterChange(filterMode, newPath, keywordText);

      // 다음 depth 옵션 로드
      try {
        const catParams: Record<string, string> = {};
        for (let i = 0; i < newPath.length; i++) {
          catParams[`cat${i + 1}`] = newPath[i];
        }
        const res = await fetchCategoryLevels(catParams as Parameters<typeof fetchCategoryLevels>[0], token);
        const nextOpts = res.data.options;

        if (res.data.maxDepth) {
          setMaxDepth(res.data.maxDepth);
        }

        if (res.data.isLeaf) {
          onSelectLeafPath?.(newPath, res.data.leafCategoryId);
          // 리프이면 categoryId로 onSelectCategory 호출
          if (res.data.leafCategoryId) {
            onSelectCategory(res.data.leafCategoryId);
          }
        }

        setLevelOptions((prev) => {
          const next = [...prev];
          next[depth + 1] = nextOpts;
          return next;
        });
      } catch {
        // quietly ignore
      } finally {
        setLoadingStates((prev) => {
          const next = [...prev];
          next[depth] = false;
          return next;
        });
      }
    },
    [selectedPath, onKeywordSearch, filterMode, keywordText, reportFilterChange, token, onSelectLeafPath, onSelectCategory]
  );

  // 초과 깊이 옵션 처리: CategoryLevelOption[]에서 categoryId 추출
  const handleLeafOptionClick = useCallback(
    (option: CategoryLevelOption) => {
      onSelectCategory(option.categoryId);
      const fullPath = [...selectedPath, option.label];
      onKeywordSearch(fullPath.join(">"));
    },
    [selectedPath, onSelectCategory, onKeywordSearch]
  );

  const handleKeywordSubmit = useCallback(() => {
    if (keywordText.trim()) {
      onKeywordSearch(keywordText.trim());
      reportFilterChange("search", selectedPath, keywordText.trim());
    }
  }, [keywordText, onKeywordSearch, selectedPath, reportFilterChange]);

  const handleKeywordClear = useCallback(() => {
    setKeywordText("");
    onKeywordSearch("");
    reportFilterChange("search", selectedPath, "");
  }, [onKeywordSearch, selectedPath, reportFilterChange]);

  const handleHierarchyReset = useCallback(() => {
    setSelectedPath([]);
    setLevelOptions((prev) => prev.slice(0, 1));
    setLoadingStates([]);
    setKeywordText("");
    onKeywordSearch("");
    reportFilterChange("hierarchy", [], "");
  }, [onKeywordSearch, reportFilterChange]);

  const switchToHierarchy = useCallback(() => {
    setFilterMode("hierarchy");
    const keyword = selectedPath.filter(Boolean).join(">");
    if (keyword) {
      onKeywordSearch(keyword);
    } else {
      onKeywordSearch("");
    }
    reportFilterChange("hierarchy", selectedPath, keywordText);
  }, [selectedPath, onKeywordSearch, keywordText, reportFilterChange]);

  const switchToSearch = useCallback(() => {
    setFilterMode("search");
    if (keywordText.trim()) {
      onKeywordSearch(keywordText.trim());
    } else {
      onKeywordSearch("");
    }
    reportFilterChange("search", selectedPath, keywordText);
  }, [keywordText, onKeywordSearch, selectedPath, reportFilterChange]);

  const hierarchyDirty = selectedPath.length > 0 && selectedPath.some((v) => v !== null);
  const hasOptions = levelOptions.length > 0 && levelOptions[0].length > 0;

  // 현재 depth에서 표시할 Select 개수: maxDepth 또는 현재 선택된 경로 길이 + 1 중 큰 값
  const visibleLevels = Math.min(maxDepth, Math.max(selectedPath.length + 1, levelOptions.length));

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-sm">필터</h3>
        {hasOptions && (
          <div className="flex flex-wrap justify-end gap-1">
            <Button
              size="sm"
              variant="outline"
              className={getPillButtonClass(filterMode === "hierarchy")}
              onClick={switchToHierarchy}
              aria-pressed={filterMode === "hierarchy"}
            >
              분류선택
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={getPillButtonClass(filterMode === "search")}
              onClick={switchToSearch}
              aria-pressed={filterMode === "search"}
            >
              검색
            </Button>
          </div>
        )}
      </div>

      {!hasOptions && (
        <p className="text-xs text-muted-foreground">
          사용 가능한 카테고리가 없습니다
        </p>
      )}

      {hasOptions && (
        <>
          {filterMode === "hierarchy" ? (
            <div className="space-y-2">
              {Array.from({ length: visibleLevels }, (_, depth) => {
                const opts = levelOptions[depth] ?? [];
                const isLoading = loadingStates[depth] ?? false;
                const isDisabled = depth > 0 && !selectedPath[depth - 1];
                const isEmpty = !isLoading && opts.length === 0 && depth > 0 && !!selectedPath[depth - 1];

                // 초과 깊이 옵션 (CategoryLevelOption[])
                const isLeafOptions = depth > 0 && opts.length > 0 && typeof opts[0] === "object" && "categoryId" in opts[0];

                return (
                  <div key={depth} className="relative">
                    {isLeafOptions ? (
                      // 초과 깊이: 마지막 단계에서 하위 경로를 포함한 옵션 표시
                      <div className="space-y-1">
                        {(opts as CategoryLevelOption[]).map((opt) => (
                          <Button
                            key={opt.categoryId}
                            size="sm"
                            variant="outline"
                            className="w-full h-8 text-xs justify-start font-normal"
                            onClick={() => handleLeafOptionClick(opt)}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <Select
                        value={selectedPath[depth] ?? ""}
                        onValueChange={(value) => handleLevelChange(depth, value ?? "")}
                        disabled={isDisabled || isLoading || isEmpty}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={
                            isDisabled ? "상위 분류 선택 필요"
                            : isLoading ? "로딩 중..."
                            : isEmpty ? "하위 분류 없음"
                            : "카테고리 선택"
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">카테고리 선택</SelectItem>
                          {(opts as string[]).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {isLoading && (
                      <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                );
              })}

              <Button
                size="sm"
                variant="outline"
                onClick={handleHierarchyReset}
                disabled={!hierarchyDirty}
                className="w-full h-8 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                초기화
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="카테고리명 검색..."
                  value={keywordText}
                  onChange={(e) => setKeywordText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleKeywordSubmit();
                  }}
                  className="h-9 text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleKeywordSubmit}
                  disabled={!keywordText.trim()}
                  className="h-9 shrink-0"
                  aria-label="검색"
                >
                  <Search className="h-4 w-4" />
                </Button>
                {keywordText && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleKeywordClear}
                    className="h-9 shrink-0"
                    aria-label="초기화"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: TypeScript 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: embed-page-inner.tsx에서 타입 에러 발생 가능 (후속 Task에서 수정).

- [ ] **Step 3: Commit**

```bash
git add nextjs/components/admin/category-hierarchy.tsx
git commit -m "refactor: CategoryHierarchy를 동적 Select + 배열 기반 상태로 전면 재작성"
```

---

### Task 8: 프론트엔드 — SSR page.tsx 변경

**Files:**
- Modify: `nextjs/app/embed/page.tsx`

- [ ] **Step 1: SSR prefetch 로직 변경**

`page.tsx`의 levels prefetch 부분을 다음으로 교체한다.

기존 코드 (전체 levels prefetch 블록, 대략 50-72행):
```typescript
  // 계층별 옵션 prefetch
  let 대Options: string[] = [];
  let 중Options: string[] = [];
  let 소Options: string[] = [];
  let 세Options: { 세: string; categoryId: number; categoryCode: string }[] = [];

  try {
    const 대Res = await fetchCategoryLevels(undefined, token);
    대Options = 대Res.data.대 ?? [];

    if (cat1) {
      const 중Res = await fetchCategoryLevels({ 대: cat1 }, token);
      중Options = 중Res.data.중 ?? [];
    }
    if (cat1 && cat2) {
      const 소Res = await fetchCategoryLevels({ 대: cat1, 중: cat2 }, token);
      소Options = 소Res.data.소 ?? [];
    }
    if (cat1 && cat2 && cat3) {
      const 세Res = await fetchCategoryLevels({ 대: cat1, 중: cat2, 소: cat3 }, token);
      세Options = 세Res.data.세 ?? [];
    }
  } catch {}
```

신규 코드:
```typescript
  // 계층별 옵션 prefetch (동적 깊이)
  let levelOptions: string[][] = [];
  let maxDepth = 1;

  try {
    // 최상위 옵션 조회
    const topRes = await fetchCategoryLevels(undefined, token);
    levelOptions.push(topRes.data.options as string[]);
    maxDepth = topRes.data.maxDepth;

    // URL cat 파라미터가 있으면 각 depth에 대해 다음 옵션 조회
    const catPath: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const val = reader.get(`cat${i}`);
      if (val) {
        catPath.push(val);
      } else {
        break;
      }
    }

    for (let i = 0; i < catPath.length && i < maxDepth - 1; i++) {
      const catParams: Record<string, string> = {};
      for (let j = 0; j <= i; j++) {
        catParams[`cat${j + 1}`] = catPath[j];
      }
      const res = await fetchCategoryLevels(catParams as Parameters<typeof fetchCategoryLevels>[0], token);
      levelOptions.push(res.data.options as string[]);
    }
  } catch {}
```

또한, `EmbedPageInner`에 전달하는 props를 변경한다:

기존:
```tsx
<EmbedPageInner
  server대Options={대Options}
  server중Options={중Options}
  server소Options={소Options}
  server세Options={세Options}
  ...
/>
```

신규:
```tsx
<EmbedPageInner
  serverLevelOptions={levelOptions}
  serverMaxDepth={maxDepth}
  ...
/>
```

- [ ] **Step 2: Commit**

```bash
git add nextjs/app/embed/page.tsx
git commit -m "refactor: SSR prefetch를 동적 깊이 levels API로 변경"
```

---

### Task 9: 프론트엔드 — `embed-page-inner.tsx` 변경

**Files:**
- Modify: `nextjs/app/embed/embed-page-inner.tsx`

- [ ] **Step 1: EmbedPageInner props 변경**

`EmbedPageInner`의 props 타입을 변경한다.

기존:
```typescript
export function EmbedPageInner({
  server대Options,
  server중Options,
  server소Options,
  server세Options,
  ...
}: {
  server대Options: string[];
  server중Options: string[];
  server소Options: string[];
  server세Options: { 세: string; categoryId: number; categoryCode: string }[];
  ...
})
```

신규:
```typescript
export function EmbedPageInner({
  serverLevelOptions,
  serverMaxDepth,
  ...
}: {
  serverLevelOptions: string[][];
  serverMaxDepth: number;
  ...
})
```

- [ ] **Step 2: HierarchyFilterState 초기값 변경**

기존:
```typescript
const initialHierarchy: HierarchyFilterState = {
  대: searchParams.get("cat1"),
  중: searchParams.get("cat2"),
  소: searchParams.get("cat3"),
  세: searchParams.get("cat4"),
};
```

신규:
```typescript
const initialHierarchy: HierarchyFilterState = embedParams.catPath.length > 0
  ? embedParams.catPath
  : [];
```

- [ ] **Step 3: updateURL의 cat 파라미터 로직 변경**

기존 `updateURL`의 cat 관련 부분:
```typescript
if ("cat1" in overrides) apply("cat1", overrides.cat1, ["cat2", "cat3", "cat4"]);
if ("cat2" in overrides) apply("cat2", overrides.cat2, ["cat3", "cat4"]);
if ("cat3" in overrides) apply("cat3", overrides.cat3, ["cat4"]);
if ("cat4" in overrides) apply("cat4", overrides.cat4);
```

신규:
```typescript
if ("catPath" in overrides) {
  // 기존 catN 모두 제거
  for (let i = 1; i <= 20; i++) params.delete(`cat${i}`);
  // 새 경로 설정
  if (overrides.catPath) {
    overrides.catPath.forEach((val, i) => {
      if (val) params.set(`cat${i + 1}`, val);
    });
  }
}
```

- [ ] **Step 4: handleFilterChange 변경**

기존:
```typescript
const handleFilterChange = useCallback(
  (state: { mode: "hierarchy" | "search"; hierarchy: HierarchyFilterState; keyword: string }) => {
    updateURL({
      mode: state.mode,
      cat1: state.hierarchy.대, cat2: state.hierarchy.중,
      cat3: state.hierarchy.소, cat4: state.hierarchy.세,
      q: state.keyword || undefined,
    });
  },
  [updateURL]
);
```

신규:
```typescript
const handleFilterChange = useCallback(
  (state: { mode: "hierarchy" | "search"; hierarchy: HierarchyFilterState; keyword: string }) => {
    updateURL({
      mode: state.mode,
      catPath: state.hierarchy,
      q: state.keyword || undefined,
    });
  },
  [updateURL]
);
```

- [ ] **Step 5: CategoryHierarchy 호출부 props 변경**

기존:
```tsx
<CategoryHierarchy
  ...
  initial대Options={server대Options}
  initial중Options={server중Options}
  initial소Options={server소Options}
  initial세Options={server세Options}
  ...
/>
```

신규:
```tsx
<CategoryHierarchy
  ...
  initialLevelOptions={serverLevelOptions}
  initialMaxDepth={serverMaxDepth}
  ...
/>
```

- [ ] **Step 6: onSelectLeafPath 콜백 변경**

기존:
```typescript
onSelectLeafPath={(대, 중, 소, categoryId) => {
  if (categoryId) {
    setModalReadOnly(!canModify({ id: categoryId } as Category | Recommendation));
    setModalCategoryId(categoryId);
  } else {
    const path = [대, 중, 소].filter(Boolean).join(">");
    const cat = displayCategories.find(c => c.category_name_ko === path);
    if (cat) {
      setModalReadOnly(!canModify(cat));
      setModalCategoryId(cat.id);
    }
  }
}}
```

신규:
```typescript
onSelectLeafPath={(path, categoryId) => {
  if (categoryId) {
    setModalReadOnly(!canModify({ id: categoryId } as Category | Recommendation));
    setModalCategoryId(categoryId);
  } else {
    const keyword = path.join(">");
    const cat = displayCategories.find(c => c.category_name_ko === keyword);
    if (cat) {
      setModalReadOnly(!canModify(cat));
      setModalCategoryId(cat.id);
    }
  }
}}
```

- [ ] **Step 7: TypeScript 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 8: Commit**

```bash
git add nextjs/app/embed/embed-page-inner.tsx
git commit -m "refactor: EmbedPageInner을 동적 깊이 props/state 구조로 변경"
```

---

### Task 10: 프론트엔드 — 테스트 수정

**Files:**
- Modify: `nextjs/lib/__tests__/api.test.ts:247-273`
- Modify: `nextjs/lib/__tests__/category.test.ts`
- Modify: `nextjs/app/embed/__tests__/page.test.tsx`

- [ ] **Step 1: api.test.ts의 fetchCategoryLevels 테스트 변경**

기존 테스트 (247-273행)를 다음으로 교체:

```typescript
describe("fetchCategoryLevels", () => {
  it("파라미터 없이 호출하면 최상위 목록 GET 요청을 보낸다", async () => {
    const mockData = { data: { options: ["패션의류", "식품"], maxDepth: 3, isLeaf: false, leafCategoryId: null } };
    mockResponse(mockData);

    const result = await api.fetchCategoryLevels();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/categories/levels"),
      expect.any(Object)
    );
    expect(result.data.options).toEqual(["패션의류", "식품"]);
    expect(result.data.maxDepth).toBe(3);
  });

  it("cat1 파라미터를 전달하면 쿼리스트링에 포함된다", async () => {
    const mockData = { data: { options: ["여성의류", "남성의류"], maxDepth: 3, isLeaf: false, leafCategoryId: null } };
    mockResponse(mockData);

    const result = await api.fetchCategoryLevels({ cat1: "패션의류" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("cat1=" + encodeURIComponent("패션의류")),
      expect.any(Object)
    );
    expect(result.data.options).toEqual(["여성의류", "남성의류"]);
  });
});
```

- [ ] **Step 2: category.test.ts 전면 변경**

`nextjs/lib/__tests__/category.test.ts` 전체를 다음으로 교체:

```typescript
import { describe, it, expect } from "vitest";
import { parseCategoryPath, parseHierarchy } from "@/lib/category";
import type { Category } from "@/lib/api";

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 1,
    user_id: 1,
    category_code: "50000001",
    category_name_ko: "대분류 > 중분류 > 소분류",
    category_name_zh: null,
    category_name_en: null,
    translation_status: "pending" as const,
    ...overrides,
  };
}

describe("parseCategoryPath", () => {
  it("카테고리명을 '>' 기준으로 분리한다", () => {
    expect(parseCategoryPath("패션의류>여성의류>원피스")).toEqual(["패션의류", "여성의류", "원피스"]);
  });

  it("공백을 trim 처리한다", () => {
    expect(parseCategoryPath("  패션의류  >  여성의류  ")).toEqual(["패션의류", "여성의류"]);
  });

  it("빈 문자열을 필터링한다", () => {
    expect(parseCategoryPath("A>>B")).toEqual(["A", "B"]);
  });

  it("단일 깊이 카테고리를 반환한다", () => {
    expect(parseCategoryPath("패션의류")).toEqual(["패션의류"]);
  });
});

describe("parseHierarchy", () => {
  it("3단계 카테고리명을 파싱한다", () => {
    const categories: Category[] = [
      makeCategory({
        id: 1,
        category_code: "50000001",
        category_name_ko: "패션의류>여성의류>원피스",
      }),
    ];

    const result = parseHierarchy(categories);

    expect(result).toHaveLength(1);
    expect(result[0].path).toEqual(["패션의류", "여성의류", "원피스"]);
    expect(result[0].categoryId).toBe(1);
  });

  it("5단계 카테고리도 파싱한다", () => {
    const categories: Category[] = [
      makeCategory({
        id: 1,
        category_code: "50000001",
        category_name_ko: "A>B>C>D>E",
      }),
    ];

    const result = parseHierarchy(categories);

    expect(result).toHaveLength(1);
    expect(result[0].path).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("1단계 카테고리도 포함한다", () => {
    const categories: Category[] = [
      makeCategory({ id: 1, category_name_ko: "패션의류" }),
    ];

    const result = parseHierarchy(categories);

    expect(result).toHaveLength(1);
    expect(result[0].path).toEqual(["패션의류"]);
  });

  it("빈 배열은 빈 결과를 반환한다", () => {
    const result = parseHierarchy([]);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 3: page.test.tsx의 EmbedPageInner props 변경**

`nextjs/app/embed/__tests__/page.test.tsx`에서 모든 `render(<EmbedPageInner ... />)` 호출의 props를 변경한다.

기존 패턴:
```
server대Options={[]} server중Options={[]} server소Options={[]} server세Options={[]}
```

신규 패턴:
```
serverLevelOptions={[[]]} serverMaxDepth={1}
```

파일 전체에서 위 치환을 수행한다. `vi.fn()` mock들도 `CategoryHierarchy`의 새 props에 맞게 수정이 필요할 수 있다.

- [ ] **Step 4: 프론트엔드 테스트 실행**

```bash
docker exec cl_embed_nextjs npm test
```

Expected: 모든 테스트 PASS.

- [ ] **Step 5: TypeScript 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 6: Commit**

```bash
git add nextjs/lib/__tests__/ nextjs/app/embed/__tests__/
git commit -m "test: 동적 깊이 API/컴포넌트에 맞게 테스트 수정"
```

---

### Task 11: 프론트엔드 — 홈 페이지 텍스트 변경

**Files:**
- Modify: `nextjs/app/page.tsx:18-20`

- [ ] **Step 1: "4단계 계층 필터링" 텍스트 변경**

`nextjs/app/page.tsx`의 features 배열에서:

기존:
```typescript
{
  icon: Layers,
  title: "4단계 계층 필터링",
  description:
    "통합 카테고리 체계를 대·중·소·세 4단계로 탐색합니다. 각 단계별 드롭다운으로 원하는 깊이까지 필터링하거나, 키워드로 카테고리명을 직접 검색할 수 있습니다.",
},
```

신규:
```typescript
{
  icon: Layers,
  title: "동적 계층 필터링",
  description:
    "카테고리 깊이에 따라 동적으로 생성되는 드롭다운으로 원하는 수준까지 탐색합니다. 키워드로 카테고리명을 직접 검색할 수도 있습니다.",
},
```

- [ ] **Step 2: Commit**

```bash
git add nextjs/app/page.tsx
git commit -m "fix: 4단계 고정 표현을 동적 계층 필터링으로 변경"
```

---

### Task 12: 최종 검증

- [ ] **Step 1: 백엔드 테스트**

```bash
docker exec cl_embed_laravel php artisan test --compact
```

Expected: 모든 테스트 PASS.

- [ ] **Step 2: 프론트엔드 빌드**

```bash
docker exec cl_embed_nextjs npm run build
```

Expected: 빌드 성공.

- [ ] **Step 3: run-all-checks.sh 실행**

```bash
.claude/hooks/run-all-checks.sh
```

Expected: tsc, lint, test, pint 모두 EXIT=0.

- [ ] **Step 4: Playwright로 UI 검증**

Playwright를 사용하여 `https://embed.cunlim.dev/embed`에 접속, 필터 드롭다운이 동적으로 생성되는지 확인한다.

- [ ] **Step 5: 최종 커밋 (변경사항이 있으면)**

```bash
git add -A && git commit -m "fix: 최종 검증 이슈 수정"
```
