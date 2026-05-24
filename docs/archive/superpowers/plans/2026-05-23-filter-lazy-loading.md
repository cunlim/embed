# 필터 섹션 SSR + 단계별 API 로딩 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카테고리 필터를 SSR로 렌더링하고 단계별 API 호출로 필요한 옵션만 로드하여 성능과 UX 개선

**Architecture:** Server Component에서 searchParams 기반 초기 옵션 prefetch → Client Component에 props 전달 → 단계 선택 시 fetchCategoryLevels() 호출로 다음 단계 옵션만 수신. useCategoryHierarchy 훅 제거.

**Tech Stack:** Laravel 13 (PHP), Next.js 16 App Router, TypeScript, Pest 4

---

## File Structure

| 파일 | 역할 |
|---|---|
| `laravel/app/Http/Controllers/Api/CategoryController.php` | levels() 메서드: 쿼리 파라미터 기반 필터링 |
| `nextjs/lib/api.ts` | fetchCategoryLevels 시그니처 변경, 새 응답 타입 |
| `nextjs/app/embed/page.tsx` | Server Component → Client Component props 분리 |
| `nextjs/components/admin/category-hierarchy.tsx` | props 기반 초기 옵션, 단계별 API 호출 |
| `nextjs/hooks/useCategoryHierarchy.ts` | **제거** |
| `laravel/tests/Feature/Api/CategoryLevelsTest.php` | **신규**: levels 엔드포인트 테스트 |
| `nextjs/lib/__tests__/api.test.ts` | fetchCategoryLevels 새 시그니처 테스트 |
| `nextjs/app/embed/__tests__/page.test.tsx` | useCategoryHierarchy mock 제거, 새 props 구조 반영 |

---

### Task 1: Backend - levels() API 재작성 (TDD)

**Files:**
- Create: `laravel/tests/Feature/Api/CategoryLevelsTest.php`
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php:97-120`

- [ ] **Step 1: 테스트 작성**

```php
<?php

use App\Models\Category;
use App\Models\User;

beforeEach(function () {
    $user = User::factory()->create(['role' => 'superadmin']);

    Category::factory()->createMany([
        ['user_id' => 1, 'category_name_ko' => '패션의류 > 여성의류 > 원피스',       'category_code' => 'A01'],
        ['user_id' => 1, 'category_name_ko' => '패션의류 > 여성의류 > 티셔츠',       'category_code' => 'A02'],
        ['user_id' => 1, 'category_name_ko' => '패션의류 > 남성의류 > 셔츠',         'category_code' => 'A03'],
        ['user_id' => 1, 'category_name_ko' => '식품 > 농산물 > 과일 > 사과',       'category_code' => 'A04'],
        ['user_id' => 1, 'category_name_ko' => '식품 > 농산물 > 채소',              'category_code' => 'A05'],
        ['user_id' => 2, 'category_name_ko' => '타유저 > 중분류 > 소분류',           'category_code' => 'A06'],
    ]);
});

describe('GET /api/categories/levels', function () {
    test('파라미터 없으면 대 목록을 반환한다', function () {
        $response = $this->getJson('/api/categories/levels');

        $response->assertOk();
        $data = $response->json('data');
        expect($data)->toHaveKey('대');
        expect($data['대'])->toBeArray();
        expect($data['대'])->toContain('패션의류');
        expect($data['대'])->toContain('식품');
        // user_id=2의 카테고리는 제외
        expect($data['대'])->not->toContain('타유저');
        // 중복 제거
        expect(count($data['대']))->toBe(2);
    });

    test('대 파라미터가 있으면 중 목록을 반환한다', function () {
        $response = $this->getJson('/api/categories/levels?대=패션의류');

        $response->assertOk();
        $data = $response->json('data');
        expect($data)->toHaveKey('중');
        expect($data['중'])->toBeArray();
        expect($data['중'])->toContain('여성의류');
        expect($data['중'])->toContain('남성의류');
        expect(count($data['중']))->toBe(2);
    });

    test('대,중 파라미터가 있으면 소 목록을 반환한다', function () {
        $response = $this->getJson('/api/categories/levels?대=패션의류&중=여성의류');

        $response->assertOk();
        $data = $response->json('data');
        expect($data)->toHaveKey('소');
        expect($data['소'])->toContain('원피스');
        expect($data['소'])->toContain('티셔츠');
    });

    test('대,중,소 파라미터가 있으면 세 목록을 반환한다', function () {
        $response = $this->getJson('/api/categories/levels?대=패션의류&중=여성의류&소=티셔츠');

        $response->assertOk();
        $data = $response->json('data');
        expect($data)->toHaveKey('세');
        expect($data['세'])->toBeArray();
    });

    test('세 목록에는 4단계인 항목만 포함된다', function () {
        // '채소'는 3단계 (식품>농산물>채소) → 제외
        $response = $this->getJson('/api/categories/levels?대=식품&중=농산물&소=채소');

        $response->assertOk();
        $data = $response->json('data');
        expect($data['세'])->toBeArray();
        expect($data['세'])->toHaveLength(0);
    });

    test('일치하는 항목이 없으면 빈 배열을 반환한다', function () {
        $response = $this->getJson('/api/categories/levels?대=존재하지않음');

        $response->assertOk();
        $data = $response->json('data');
        expect($data['중'])->toBeArray();
        expect($data['중'])->toHaveLength(0);
    });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryLevelsTest
```

Expected: FAIL — 테스트 파일은 존재하지만 구현이 이전 방식이므로 새 응답 형식과 불일치

- [ ] **Step 3: levels() 메서드 재작성**

`laravel/app/Http/Controllers/Api/CategoryController.php`의 `levels()` 메서드를 다음으로 교체:

```php
public function levels(Request $request): JsonResponse
{
    $대 = $request->query('대');
    $중 = $request->query('중');
    $소 = $request->query('소');

    $query = Category::query()->where('user_id', 1);

    if ($대 === null) {
        // 대 목록 반환 (중복 제거)
        $대List = $query
            ->select('category_name_ko')
            ->get()
            ->map(fn ($c) => explode('>', $c->category_name_ko)[0] ?? '')
            ->map(fn ($s) => trim($s))
            ->filter(fn ($s) => $s !== '')
            ->unique()
            ->values()
            ->toArray();

        return response()->json(['data' => ['대' => $대List]]);
    }

    // 대 필터링
    $query->where('category_name_ko', 'like', $대 . '>%');

    if ($중 === null) {
        // prefix length = strlen(대) + 2 ("> " 이후)
        $중List = $query
            ->select('category_name_ko')
            ->get()
            ->map(fn ($c) => explode('>', $c->category_name_ko)[1] ?? '')
            ->map(fn ($s) => trim($s))
            ->filter(fn ($s) => $s !== '')
            ->unique()
            ->values()
            ->toArray();

        return response()->json(['data' => ['중' => $중List]]);
    }

    $query->where('category_name_ko', 'like', $대 . ' > ' . $중 . '>%');

    if ($소 === null) {
        $소List = $query
            ->select('category_name_ko')
            ->get()
            ->map(fn ($c) => explode('>', $c->category_name_ko)[2] ?? '')
            ->map(fn ($s) => trim($s))
            ->filter(fn ($s) => $s !== '')
            ->unique()
            ->values()
            ->toArray();

        return response()->json(['data' => ['소' => $소List]]);
    }

    $query->where('category_name_ko', 'like', $대 . ' > ' . $중 . ' > ' . $소 . '%');

    // 세 목록 (categoryId, categoryCode 포함)
    $세List = $query
        ->select('id', 'category_code', 'category_name_ko')
        ->get()
        ->map(function ($c) {
            $parts = explode('>', $c->category_name_ko);
            if (count($parts) < 4) {
                return null;
            }
            return [
                '세' => trim($parts[3]),
                'categoryId' => $c->id,
                'categoryCode' => $c->category_code,
            ];
        })
        ->filter()
        ->values()
        ->toArray();

    return response()->json(['data' => ['세' => $세List]]);
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryLevelsTest
```

Expected: PASS (6 tests)

- [ ] **Step 5: Pint 포맷팅 (컨테이너 우회 방식)**

```bash
docker exec cl_embed_laravel bash -c 'cp /var/www/html/app/Http/Controllers/Api/CategoryController.php /tmp/ && vendor/bin/pint /tmp/CategoryController.php && cp /tmp/CategoryController.php /var/www/html/app/Http/Controllers/Api/'
cat /var/app/www/cl_embed/laravel/app/Http/Controllers/Api/CategoryController.php | base64 | docker exec -i cl_embed_laravel bash -c "base64 -d > /var/www/html/app/Http/Controllers/Api/CategoryController.php"
```

- [ ] **Step 6: 전체 테스트로 회귀 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact
```

Expected: PASS (no new failures)

- [ ] **Step 7: Commit**

```bash
git add laravel/tests/Feature/Api/CategoryLevelsTest.php laravel/app/Http/Controllers/Api/CategoryController.php
git commit -m "feat(api): levels 엔드포인트에 단계별 쿼리 파라미터 필터링 추가"
```

---

### Task 2: Frontend - API 클라이언트 타입 및 함수 업데이트 (TDD)

**Files:**
- Modify: `nextjs/lib/api.ts:162-173`
- Modify: `nextjs/lib/__tests__/api.test.ts`

- [ ] **Step 1: fetchCategoryLevels 테스트 업데이트**

`nextjs/lib/__tests__/api.test.ts`에 추가:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchCategoryLevels } from "@/lib/api";

// ... existing imports

describe("fetchCategoryLevels", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("파라미터 없이 호출하면 대 목록 GET 요청을 보낸다", async () => {
    const mockData = { data: { 대: ["패션의류", "식품"] } };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await fetchCategoryLevels();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/categories/levels"),
      expect.any(Object)
    );
    expect(result.data.대).toEqual(["패션의류", "식품"]);
  });

  it("대 파라미터를 전달하면 쿼리스트링에 포함된다", async () => {
    const mockData = { data: { 중: ["여성의류", "남성의류"] } };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await fetchCategoryLevels({ 대: "패션의류" });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("대=패션의류"),
      expect.any(Object)
    );
    expect(result.data.중).toEqual(["여성의류", "남성의류"]);
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

```bash
docker exec cl_embed_nextjs npx vitest run lib/__tests__/api.test.ts
```

Expected: FAIL — 새 시그니처와 불일치

- [ ] **Step 3: API 클라이언트 업데이트**

`nextjs/lib/api.ts`의 `HierarchyLevelItem` 인터페이스와 `fetchCategoryLevels` 함수를 다음으로 교체:

```typescript
// 기존 HierarchyLevelItem 인터페이스 제거하고 다음으로 교체
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
}

export function fetchCategoryLevels(
  params?: CategoryLevelsParams
): Promise<{ data: CategoryLevelsResponse }> {
  const searchParams = new URLSearchParams();
  if (params?.대) searchParams.set("대", params.대);
  if (params?.중) searchParams.set("중", params.중);
  if (params?.소) searchParams.set("소", params.소);
  const qs = searchParams.toString();
  return request<{ data: CategoryLevelsResponse }>(
    `/categories/levels${qs ? "?" + qs : ""}`,
    { cache: "no-store" }
  );
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

```bash
docker exec cl_embed_nextjs npx vitest run lib/__tests__/api.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add nextjs/lib/api.ts nextjs/lib/__tests__/api.test.ts
git commit -m "feat(api): fetchCategoryLevels에 단계별 쿼리 파라미터 지원 추가"
```

---

### Task 3: Frontend - CategoryHierarchy 컴포넌트 리팩터링

**Files:**
- Modify: `nextjs/components/admin/category-hierarchy.tsx`
- Delete: `nextjs/hooks/useCategoryHierarchy.ts`

- [ ] **Step 1: CategoryHierarchy 컴포넌트 재작성**

`nextjs/components/admin/category-hierarchy.tsx` 전체를 다음으로 교체:

```typescript
"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchCategoryLevels, type CategoryLevelsResponse } from "@/lib/api";
import { Search, X, RotateCcw, Loader2 } from "lucide-react";

export interface HierarchyFilterState {
  대: string | null;
  중: string | null;
  소: string | null;
}

interface CategoryHierarchyProps {
  onSelectCategory: (categoryId: number) => void;
  onKeywordSearch: (keyword: string) => void;
  /** URL 등 외부에서 초기값 주입 */
  initialMode?: "hierarchy" | "search";
  initialHierarchy?: HierarchyFilterState;
  initialKeyword?: string;
  /** SSR prefetch 데이터 */
  initial대Options: string[];
  initial중Options?: string[];
  initial소Options?: string[];
  initial세Options?: { 세: string; categoryId: number; categoryCode: string }[];
  /** 필터 상태 변경 시 호출 (URL 동기화용) */
  onFilterChange?: (state: {
    mode: "hierarchy" | "search";
    hierarchy: HierarchyFilterState;
    keyword: string;
  }) => void;
}

export default function CategoryHierarchy({
  onSelectCategory,
  onKeywordSearch,
  initialMode = "hierarchy",
  initialHierarchy,
  initialKeyword = "",
  initial대Options,
  initial중Options = [],
  initial소Options = [],
  initial세Options = [],
  onFilterChange,
}: CategoryHierarchyProps) {
  const [filterMode, setFilterMode] = useState<"hierarchy" | "search">(initialMode);
  const [selected대, setSelected대] = useState<string | null>(initialHierarchy?.대 ?? null);
  const [selected중, setSelected중] = useState<string | null>(initialHierarchy?.중 ?? null);
  const [selected소, setSelected소] = useState<string | null>(initialHierarchy?.소 ?? null);
  const [keywordText, setKeywordText] = useState(initialKeyword);

  // 단계별 옵션 (SSR 초기값 + API 응답)
  const [대Options] = useState<string[]>(initial대Options);
  const [중Options, set중Options] = useState<string[]>(initial중Options);
  const [소Options, set소Options] = useState<string[]>(initial소Options);
  const [세Options, set세Options] = useState<{ 세: string; categoryId: number; categoryCode: string }[]>(
    initial세Options
  );

  // 로딩 상태
  const [loading중, setLoading중] = useState(false);
  const [loading소, setLoading소] = useState(false);
  const [loading세, setLoading세] = useState(false);

  const reportFilterChange = useCallback(
    (mode: "hierarchy" | "search", 대: string | null, 중: string | null, 소: string | null, kw: string) => {
      onFilterChange?.({ mode, hierarchy: { 대, 중, 소 }, keyword: kw });
    },
    [onFilterChange]
  );

  const handle대Change = useCallback(
    async (v: string) => {
      if (!v) return;
      setSelected대(v);
      setSelected중(null);
      setSelected소(null);
      set중Options([]);
      set소Options([]);
      set세Options([]);

      onKeywordSearch(v);
      reportFilterChange(filterMode, v, null, null, keywordText);

      setLoading중(true);
      try {
        const res = await fetchCategoryLevels({ 대: v });
        set중Options(res.data.중 ?? []);
      } catch {
        // quietly ignore
      } finally {
        setLoading중(false);
      }
    },
    [onKeywordSearch, filterMode, keywordText, reportFilterChange]
  );

  const handle중Change = useCallback(
    async (v: string) => {
      if (!v || !selected대) return;
      setSelected중(v);
      setSelected소(null);
      set소Options([]);
      set세Options([]);

      onKeywordSearch(selected대 + " > " + v);
      reportFilterChange(filterMode, selected대, v, null, keywordText);

      setLoading소(true);
      try {
        const res = await fetchCategoryLevels({ 대: selected대, 중: v });
        set소Options(res.data.소 ?? []);
      } catch {
        // quietly ignore
      } finally {
        setLoading소(false);
      }
    },
    [selected대, onKeywordSearch, filterMode, keywordText, reportFilterChange]
  );

  const handle소Change = useCallback(
    async (v: string) => {
      if (!v || !selected대 || !selected중) return;
      setSelected소(v);
      set세Options([]);

      onKeywordSearch(selected대 + " > " + selected중 + " > " + v);
      reportFilterChange(filterMode, selected대, selected중, v, keywordText);

      setLoading세(true);
      try {
        const res = await fetchCategoryLevels({ 대: selected대, 중: selected중, 소: v });
        set세Options(res.data.세 ?? []);
      } catch {
        // quietly ignore
      } finally {
        setLoading세(false);
      }
    },
    [selected대, selected중, onKeywordSearch, filterMode, keywordText, reportFilterChange]
  );

  const handle세Change = useCallback(
    (v: string) => {
      if (!v) return;
      const found = 세Options.find((o) => o.categoryCode === v);
      if (found) onSelectCategory(found.categoryId);
    },
    [세Options, onSelectCategory]
  );

  const handleKeywordSubmit = useCallback(() => {
    if (keywordText.trim()) {
      onKeywordSearch(keywordText.trim());
      reportFilterChange("search", selected대, selected중, selected소, keywordText.trim());
    }
  }, [keywordText, onKeywordSearch, selected대, selected중, selected소, reportFilterChange]);

  const handleKeywordClear = useCallback(() => {
    setKeywordText("");
    onKeywordSearch("");
    reportFilterChange("search", selected대, selected중, selected소, "");
  }, [onKeywordSearch, selected대, selected중, selected소, reportFilterChange]);

  const handleHierarchyReset = useCallback(() => {
    setSelected대(null);
    setSelected중(null);
    setSelected소(null);
    set중Options([]);
    set소Options([]);
    set세Options([]);
    onKeywordSearch("");
    reportFilterChange("hierarchy", null, null, null, keywordText);
  }, [onKeywordSearch, keywordText, reportFilterChange]);

  const switchToHierarchy = useCallback(() => {
    setFilterMode("hierarchy");
    if (selected대) {
      const keyword = selected소
        ? selected대 + " > " + selected중 + " > " + selected소
        : selected중
          ? selected대 + " > " + selected중
          : selected대;
      onKeywordSearch(keyword);
      reportFilterChange("hierarchy", selected대, selected중, selected소, keywordText);
    } else {
      onKeywordSearch("");
      reportFilterChange("hierarchy", null, null, null, keywordText);
    }
  }, [selected대, selected중, selected소, onKeywordSearch, keywordText, reportFilterChange]);

  const switchToSearch = useCallback(() => {
    setFilterMode("search");
    if (keywordText.trim()) {
      onKeywordSearch(keywordText.trim());
      reportFilterChange("search", selected대, selected중, selected소, keywordText);
    } else {
      onKeywordSearch("");
      reportFilterChange("search", selected대, selected중, selected소, "");
    }
  }, [keywordText, onKeywordSearch, selected대, selected중, selected소, reportFilterChange]);

  const hierarchyDirty = selected대 !== null;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-medium text-sm">필터</h3>
        {initial대Options.length > 0 && (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={filterMode === "hierarchy" ? "secondary" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={switchToHierarchy}
            >
              분류선택
            </Button>
            <Button
              size="sm"
              variant={filterMode === "search" ? "secondary" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={switchToSearch}
            >
              검색
            </Button>
          </div>
        )}
      </div>

      {initial대Options.length === 0 && (
        <p className="text-xs text-muted-foreground">
          사용 가능한 카테고리가 없습니다
        </p>
      )}

      {initial대Options.length > 0 && (
        <>
          {filterMode === "hierarchy" ? (
            <div className="space-y-2">
              <select
                value={selected대 ?? ""}
                onChange={(e) => handle대Change(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                <option value="">카테고리 선택</option>
                {대Options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>

              {selected대 && (
                <div className="relative">
                  <select
                    value={selected중 ?? ""}
                    onChange={(e) => handle중Change(e.target.value)}
                    disabled={loading중}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:opacity-50"
                  >
                    <option value="">
                      {loading중 ? "로딩 중..." : 중Options.length === 0 ? "중분류 없음" : "카테고리 선택"}
                    </option>
                    {중Options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {loading중 && (
                    <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              )}

              {selected중 && (
                <div className="relative">
                  <select
                    value={selected소 ?? ""}
                    onChange={(e) => handle소Change(e.target.value)}
                    disabled={loading소}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:opacity-50"
                  >
                    <option value="">
                      {loading소 ? "로딩 중..." : 소Options.length === 0 ? "소분류 없음" : "카테고리 선택"}
                    </option>
                    {소Options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {loading소 && (
                    <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              )}

              {selected소 && (
                <div className="relative">
                  <select
                    value=""
                    onChange={(e) => handle세Change(e.target.value)}
                    disabled={loading세 || 세Options.length === 0}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:opacity-50"
                  >
                    <option value="">
                      {loading세 ? "로딩 중..." : 세Options.length === 0 ? "세분류 없음" : "카테고리 선택"}
                    </option>
                    {세Options.map((opt) => (
                      <option key={opt.categoryCode} value={opt.categoryCode}>{opt.세}</option>
                    ))}
                  </select>
                  {loading세 && (
                    <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              )}

              {hierarchyDirty && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleHierarchyReset}
                  className="w-full h-8 text-xs"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  초기화
                </Button>
              )}
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
                  variant="secondary"
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

- [ ] **Step 2: useCategoryHierarchy 훅 제거**

```bash
rm /var/app/www/cl_embed/nextjs/hooks/useCategoryHierarchy.ts
```

- [ ] **Step 3: Commit**

```bash
git add nextjs/components/admin/category-hierarchy.tsx
git rm nextjs/hooks/useCategoryHierarchy.ts
git commit -m "refactor(embed): CategoryHierarchy를 SSR props + 단계별 API 로딩으로 전환"
```

---

### Task 4: Frontend - EmbedPage Server Component 분리

**Files:**
- Modify: `nextjs/app/embed/page.tsx`

- [ ] **Step 1: EmbedPage를 Server Component로, EmbedPageInner를 Client Component로 분리**

`nextjs/app/embed/page.tsx`에서 `EmbedPage` 함수를 다음으로 교체하고, `EmbedPageInner`의 props와 filter 관련 코드 갱신:

`EmbedPage` (기존 Server Component wrapper 교체):

```typescript
// 기존 import 유지 + 추가
import { fetchCategoryLevels } from "@/lib/api";

// 기존 getPageRange, getEllipsisTarget 함수 유지

export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;

  const cat1 = typeof sp.cat1 === "string" ? sp.cat1 : null;
  const cat2 = typeof sp.cat2 === "string" ? sp.cat2 : null;
  const cat3 = typeof sp.cat3 === "string" ? sp.cat3 : null;

  // 대 옵션 항상 prefetch
  let 대Options: string[] = [];
  let 중Options: string[] = [];
  let 소Options: string[] = [];
  let 세Options: { 세: string; categoryId: number; categoryCode: string }[] = [];

  try {
    const 대Res = await fetchCategoryLevels();
    대Options = 대Res.data.대 ?? [];

    if (cat1) {
      const 중Res = await fetchCategoryLevels({ 대: cat1 });
      중Options = 중Res.data.중 ?? [];
    }
    if (cat1 && cat2) {
      const 소Res = await fetchCategoryLevels({ 대: cat1, 중: cat2 });
      소Options = 소Res.data.소 ?? [];
    }
    if (cat1 && cat2 && cat3) {
      const 세Res = await fetchCategoryLevels({ 대: cat1, 중: cat2, 소: cat3 });
      세Options = 세Res.data.세 ?? [];
    }
  } catch {
    // prefetch 실패 시 클라이언트에서 로드
  }

  return (
    <Suspense>
      <EmbedPageInner
        server대Options={대Options}
        server중Options={중Options}
        server소Options={소Options}
        server세Options={세Options}
      />
    </Suspense>
  );
}
```

`EmbedPageInner`에 props 추가 (기존 시그니처 변경):

```typescript
function EmbedPageInner({
  server대Options,
  server중Options,
  server소Options,
  server세Options,
}: {
  server대Options: string[];
  server중Options: string[];
  server소Options: string[];
  server세Options: { 세: string; categoryId: number; categoryCode: string }[];
}) {
```

그리고 `<CategoryHierarchy>` 호출부에 새 props 전달:

```typescript
<CategoryHierarchy
  onSelectCategory={(categoryId) => {
    // ... 기존 코드 유지
  }}
  onKeywordSearch={handleKeywordSearch}
  initialMode={initialFilterMode}
  initialHierarchy={initialHierarchy}
  initialKeyword={initialFilterKeyword}
  onFilterChange={handleFilterChange}
  initial대Options={server대Options}
  initial중Options={server중Options}
  initial소Options={server소Options}
  initial세Options={server세Options}
/>
```

- [ ] **Step 2: 기존 `import { useCategoryHierarchy }` 참조 제거 확인**

`app/embed/page.tsx`에서 `useCategoryHierarchy` import가 이미 없어야 함 (기존에는 `CategoryHierarchy` 컴포넌트 내부에서만 사용).

- [ ] **Step 3: TypeScript 컴파일 확인**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: PASS (no type errors)

- [ ] **Step 4: Commit**

```bash
git add nextjs/app/embed/page.tsx
git commit -m "feat(embed): EmbedPage를 Server Component로 분리하여 필터 옵션 SSR prefetch"
```

---

### Task 5: Frontend - 기존 테스트 업데이트

**Files:**
- Modify: `nextjs/app/embed/__tests__/page.test.tsx`

- [ ] **Step 1: embed 페이지 테스트에서 useCategoryHierarchy mock 제거**

`nextjs/app/embed/__tests__/page.test.tsx`에서:

1. `vi.mock("@/hooks/useCategoryHierarchy"...)` 제거
2. `import { useCategoryHierarchy }` 제거
3. `mockUseCategoryHierarchy` 제거
4. `beforeEach` 내 `mockUseCategoryHierarchy.mockReturnValue(...)` 제거
5. `EmbedPageInner`를 직접 import하고 렌더링하도록 변경 (Server Component 대신 Client Component 테스트):

```typescript
// 기존 페이지 import 변경
import EmbedPageInner from "../page"; // → export 추가 필요

// 모든 render 호출에 server props 추가
render(
  <EmbedPageInner
    server대Options={["의류", "식품"]}
    server중Options={[]}
    server소Options={[]}
    server세Options={[]}
  />
);
```

참고: `EmbedPageInner` 함수에 `export` 키워드 추가 필요 (`page.tsx`의 `function EmbedPageInner` → `export function EmbedPageInner`)

- [ ] **Step 2: 테스트 실행하여 통과 확인**

```bash
docker exec cl_embed_nextjs npx vitest run app/embed/__tests__/page.test.tsx
```

Expected: PASS (all existing tests)

- [ ] **Step 3: Commit**

```bash
git add nextjs/app/embed/__tests__/page.test.tsx nextjs/app/embed/page.tsx
git commit -m "test(embed): useCategoryHierarchy mock 제거 및 Server Component 분리 반영"
```

---

### Task 6: Frontend - hooks/__tests__/useCategoryHierarchy.test.ts 제거

**Files:**
- Delete: `nextjs/hooks/__tests__/useCategoryHierarchy.test.ts` (있는 경우)

- [ ] **Step 1: 테스트 파일 존재 확인 및 제거**

```bash
ls /var/app/www/cl_embed/nextjs/hooks/__tests__/useCategoryHierarchy.test.ts 2>/dev/null && git rm /var/app/www/cl_embed/nextjs/hooks/__tests__/useCategoryHierarchy.test.ts || echo "파일 없음, skip"
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: useCategoryHierarchy 테스트 제거"
```
(파일이 없는 경우 skip)

---

### Task 7: 전체 테스트 실행 및 회귀 확인

- [ ] **Step 1: Laravel 전체 테스트**

```bash
docker exec cl_embed_laravel php artisan test --compact
```

Expected: PASS (no failures)

- [ ] **Step 2: Next.js 전체 테스트**

```bash
docker exec cl_embed_nextjs npx vitest run
```

Expected: PASS (no failures)

- [ ] **Step 3: TypeScript 타입 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: PASS (no errors)

- [ ] **Step 4: ESLint**

```bash
docker exec cl_embed_nextjs npm run lint
```

Expected: PASS (no new errors; pre-existing warnings acceptable)

---

### Task 8: Playwright E2E 검증

- [ ] **Step 1: embed 페이지 로드 후 대 option이 초기 HTML에 포함되는지 확인**

```typescript
async (page) => {
  await page.goto('https://embed.cunlim.dev/embed');
  // 페이지 로드 직후 select > option 존재 확인
  const options = await page.locator('select').first().locator('option').allTextContents();
  return { optionCount: options.length, firstOptions: options.slice(0, 5) };
}
```

Expected: optionCount > 1, 대분류 목록이 SSR로 즉시 렌더링됨

- [ ] **Step 2: 대 선택 후 중 옵션이 API로 로드되는지 확인**

Playwright로 대 선택 → 네트워크 요청 발생 확인 → 중 옵션 렌더링 확인

- [ ] **Step 3: 초기화 버튼 클릭 시 즉시 초기화 (지연 없음) 확인**

```typescript
async (page) => {
  const start = Date.now();
  await page.locator('button:has-text("초기화")').first().click();
  await page.waitForTimeout(100);
  return Date.now() - start;
}
```

Expected: < 200ms (기존 1500ms → 대폭 개선)

---

### Task 9: 최종 통합 검증 및 완료

- [ ] **Step 1: `.claude/hooks/run-all-checks.sh` 실행**

```bash
bash /var/app/www/cl_embed/.claude/hooks/run-all-checks.sh
```

Expected: 모든 체크 통과

- [ ] **Step 2: 최종 Commit**

```bash
git add -A
git commit -m "feat(embed): 필터 섹션 SSR 렌더링 및 단계별 지연 로딩 구현"
```
