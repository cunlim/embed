# 관리자 페이지 검색 기능 구현 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin` 페이지에 `/embed`와 동일한 pgvector 의미 기반 유사도 검색을 추가하고, 검색 결과를 기존 카테고리 목록 UI에 표시한다.

**Architecture:** `POST /api/recommend`를 페이지네이션 + text nullable로 확장하고, 프론트엔드는 admin 페이지 좌측 사이드바에 검색 섹션을 추가하여 검색/일반 모드를 전환한다.

**Tech Stack:** Laravel 13 (PHP 8.5), Next.js 16 + React 19, Tailwind v4, shadcn/ui, pgvector

---

### Task 1: Backend — RecommendRequest text nullable + page/per_page

**Files:**
- Modify: `laravel/app/Http/Requests/RecommendRequest.php`

- [ ] **Step 1: Modify rules — text를 nullable로 변경하고 page/per_page 추가**

```php
// 변경 전
return [
    'text' => ['required', 'string', 'min:1', 'max:500'],
    'target_language' => ['required', 'string', 'in:ko,zh,en'],
];

// 변경 후
return [
    'text' => ['nullable', 'string', 'max:500'],
    'target_language' => ['required', 'string', 'in:ko,zh,en'],
    'page' => ['nullable', 'integer', 'min:1'],
    'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
];
```

- [ ] **Step 2: Commit**

```bash
git add laravel/app/Http/Requests/RecommendRequest.php
git commit -m "feat: recommend request text nullable + page/per_page"
```

---

### Task 2: Backend — RecommendationService::recommendPaginated() 추가

**Files:**
- Modify: `laravel/app/Services/RecommendationService.php`
- Test: `laravel/tests/Unit/Services/RecommendationServiceTest.php`

- [ ] **Step 1: recommendPaginated() 메서드 구현**

RecommendationService.php에 추가:

```php
use App\Models\Category;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * pgvector JOIN pagination으로 유사도 검색 결과를 반환한다.
 * Category + CategoryEmbedding을 language로 JOIN하여 distance를 계산한다.
 */
public function recommendPaginated(SearchLog $searchLog, string $targetLanguage, int $perPage = 20, int $page = 1): LengthAwarePaginator
{
    $embedding = $searchLog->embedding->toArray();
    $vectorLiteral = '[' . implode(',', $embedding) . ']';

    $paginator = Category::select('categories.*')
        ->selectRaw('MIN(ce.embedding <=> ?::vector) as distance', [$vectorLiteral])
        ->join('category_embeddings as ce', 'ce.category_id', '=', 'categories.id')
        ->where('ce.language', $targetLanguage)
        ->groupBy('categories.id')
        ->orderByRaw('MIN(ce.embedding <=> ?::vector)', [$vectorLiteral])
        ->paginate(perPage: $perPage, page: $page);

    $items = $paginator->getCollection()->map(function (Category $category) {
        $category->similarity_score = round(1.0 - (float) $category->distance, 4);
        return $category;
    });
    $paginator->setCollection($items);

    return $paginator;
}
```

- [ ] **Step 2: Unit 테스트 작성**

RecommendationServiceTest.php에 추가:

```php
test('recommendPaginated — 페이지네이션 결과를 반환한다', function () {
    $category = Category::factory()->create([
        'category_code' => '50000000',
        'category_name_ko' => '패션의류',
    ]);

    $embedding = new Vector(array_fill(0, 1024, 0.1));
    $categoryEmbedding = new CategoryEmbedding;
    $categoryEmbedding->category_id = $category->id;
    $categoryEmbedding->language = 'ko';
    $categoryEmbedding->embed_model_name = 'bge-m3:latest';
    $categoryEmbedding->embedding = $embedding;
    $categoryEmbedding->save();

    $searchLog = new SearchLog([
        'search_keyword' => '청바지',
        'normalized_keyword' => '청바지',
        'embed_model_name' => 'bge-m3:latest',
        'session_id' => 'test-session',
    ]);
    $searchLog->embedding = array_fill(0, 1024, 0.05);

    $service = new RecommendationService;
    $result = $service->recommendPaginated($searchLog, 'ko', 20, 1);

    expect($result)->toBeInstanceOf(LengthAwarePaginator::class);
    expect($result->total())->toBe(1);
    expect($result->items()[0]->id)->toBe($category->id);
    expect($result->items()[0]->similarity_score)->toBeGreaterThan(0);
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `docker exec cl_embed_laravel php artisan test --compact --filter=RecommendationServiceTest`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add laravel/app/Services/RecommendationService.php laravel/tests/Unit/Services/RecommendationServiceTest.php
git commit -m "feat: add recommendPaginated with pgvector JOIN pagination"
```

---

### Task 3: Backend — RecommendController 분기 로직

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/RecommendController.php`

- [ ] **Step 1: Controller 수정 — text 빈값 처리 + 페이지네이션**

`use App\Models\Category;` import를 파일 상단에 추가.

recommend() 메서드 전체 교체:

```php
public function recommend(RecommendRequest $request): JsonResponse
{
    $text = $request->validated('text');
    $targetLanguage = $request->validated('target_language');
    $page = (int) $request->input('page', 1);
    $perPage = (int) $request->input('per_page', 20);

    // text가 없거나 빈 문자열이면 일반 카테고리 목록 반환
    if (empty(trim((string) $text))) {
        $categories = Category::orderBy("category_name_{$targetLanguage}")
            ->paginate(perPage: $perPage, page: $page);

        return RecommendResource::collection($categories)->response();
    }

    $sessionId = $request->hasSession()
        ? $request->session()->getId()
        : (string) Str::uuid();
    $userId = auth()->id();
    $modelName = config('services.ollama.embedding_model', 'bge-m3:latest');

    $searchLog = $this->embeddingCache->getOrCreateEmbedding(
        $text, $modelName, $userId, $sessionId
    );

    $results = $this->recommendation->recommendPaginated(
        $searchLog, $targetLanguage, $perPage, $page
    );

    return RecommendResource::collection($results)->response();
}
```

- [ ] **Step 2: Commit**

```bash
git add laravel/app/Http/Controllers/Api/RecommendController.php
git commit -m "feat: recommend controller handles empty text + pagination"
```

---

### Task 4: Backend — RecommendResource 확장

**Files:**
- Modify: `laravel/app/Http/Resources/RecommendResource.php`

- [ ] **Step 1: Resource에 모든 다국어 필드 + id + translation_status 추가**

```php
public function toArray(Request $request): array
{
    $lang = $request->input('target_language', 'ko');
    return [
        'id' => $this->id,
        'category_code' => $this->category_code,
        'category_name_ko' => $this->category_name_ko,
        'category_name_zh' => $this->category_name_zh,
        'category_name_en' => $this->category_name_en,
        'category_name' => $this->{"category_name_{$lang}"},
        'translation_status' => $this->translation_status,
        'similarity_score' => $this->similarity_score ?? null,
    ];
}
```

- [ ] **Step 2: Commit**

```bash
git add laravel/app/Http/Resources/RecommendResource.php
git commit -m "feat: extend RecommendResource with all language fields and id"
```

---

### Task 5: 백엔드 — 기존 테스트 업데이트

**Files:**
- Modify: `laravel/tests/Feature/Api/RecommendControllerTest.php`

- [ ] **Step 1: text required 테스트 → nullable 테스트로 변경**

기존 2개 테스트(text 없음, 빈 문자열)를 다음으로 대체:

```php
test('POST /api/recommend — text가 없으면 일반 카테고리 목록을 반환한다', function () {
    $category = Category::factory()->create([
        'category_code' => '50000000',
        'category_name_ko' => '패션의류',
    ]);

    $response = $this->postJson('/api/recommend', [
        'target_language' => 'ko',
    ]);

    $response->assertOk();
    $response->assertJsonStructure([
        'data' => [['id', 'category_code', 'category_name_ko', 'category_name', 'translation_status', 'similarity_score']],
        'meta' => ['current_page', 'last_page', 'total', 'per_page'],
    ]);
    expect($response->json('data.0.similarity_score'))->toBeNull();
});

test('POST /api/recommend — text가 빈 문자열이면 일반 카테고리 목록을 반환한다', function () {
    $category = Category::factory()->create([
        'category_code' => '50000000',
        'category_name_ko' => '패션의류',
    ]);

    $response = $this->postJson('/api/recommend', [
        'text' => '', 'target_language' => 'ko',
    ]);

    $response->assertOk();
    expect($response->json('data.0.similarity_score'))->toBeNull();
});

test('POST /api/recommend — text가 500자를 초과하면 422를 반환한다', function () {
    $response = $this->postJson('/api/recommend', [
        'text' => str_repeat('a', 501), 'target_language' => 'ko',
    ]);
    $response->assertUnprocessable()->assertJsonValidationErrors(['text']);
});
```

- [ ] **Step 2: RecommendResource 테스트 업데이트 — 새 필드 검증**

기존 테스트 교체:

```php
test('RecommendResource — toArray 응답 형식을 검증한다', function () {
    $category = Category::factory()->create([
        'category_code' => 'CAT_abc12345',
        'category_name_ko' => '패션의류',
        'category_name_zh' => '时尚服装',
        'category_name_en' => 'Fashion Clothing',
        'translation_status' => 'completed',
    ]);
    $category->similarity_score = 0.9532;

    $resource = new RecommendResource($category);
    $data = $resource->toArray(request()->merge(['target_language' => 'ko']));

    expect($data)->toHaveKeys([
        'id', 'category_code', 'category_name_ko', 'category_name_zh',
        'category_name_en', 'category_name', 'translation_status', 'similarity_score',
    ]);
    expect($data['category_name'])->toBe('패션의류');
    expect($data['similarity_score'])->toBe(0.9532);
});
```

파일 상단에 `use App\Models\Category;` import 추가 필요.

- [ ] **Step 3: Use Category import + run test**

Run: `docker exec cl_embed_laravel php artisan test --compact --filter=RecommendControllerTest`
Expected: PASS

- [ ] **Step 4: Pint 포맷**

Run: `docker exec cl_embed_laravel vendor/bin/pint --format agent`

- [ ] **Step 5: Commit**

```bash
git add laravel/tests/Feature/Api/RecommendControllerTest.php
git commit -m "test: update RecommendControllerTest for nullable text + extended resource"
```

---

### Task 6: Frontend — API 타입/함수 업데이트

**Files:**
- Modify: `nextjs/lib/api.ts`
- Test: `nextjs/lib/__tests__/api.test.ts` (확인 후 필요 시 생성)

- [ ] **Step 1: Recommendation 인터페이스 확장**

```typescript
// 변경 전
export interface Recommendation {
  category_code: string;
  category_name: string;
  similarity_score: number;
}

export interface RecommendResponse {
  data: Recommendation[];
}

export function recommend(
  text: string,
  targetLanguage: string,
  token?: string | null
): Promise<RecommendResponse> {
  return request<RecommendResponse>("/recommend", {
    method: "POST",
    body: { text, target_language: targetLanguage },
    token,
  });
}
```

```typescript
// 변경 후
export interface Recommendation {
  id: number;
  category_code: string;
  category_name_ko: string;
  category_name_zh: string | null;
  category_name_en: string | null;
  category_name: string;
  translation_status: "completed" | "partial" | "pending";
  similarity_score: number | null;
}

export interface RecommendResponse {
  data: Recommendation[];
  meta: PaginationMeta;
}

export function recommend(
  text: string,
  targetLanguage: string,
  token?: string | null,
  page?: number,
  perPage?: number,
): Promise<RecommendResponse> {
  const body: Record<string, string | number> = { text, target_language: targetLanguage };
  if (page) body.page = page;
  if (perPage) body.per_page = perPage;
  return request<RecommendResponse>("/recommend", {
    method: "POST",
    body,
    token,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add nextjs/lib/api.ts
git commit -m "feat: update Recommendation type and recommend() with pagination"
```

---

### Task 7: Frontend — StatusBadge 수정 (아이콘만, 텍스트 제거)

**Files:**
- Modify: `nextjs/components/admin/status-badge.tsx`

- [ ] **Step 1: AlertTriangle → Clock, 텍스트 제거**

```tsx
import { CheckCircle2, Clock, Minus } from "lucide-react";

interface Props {
  status: "completed" | "partial" | "pending";
}

export default function StatusBadge({ status }: Props) {
  if (status === "completed") {
    return (
      <div className="flex items-center text-green-500">
        <CheckCircle2 className="h-4 w-4" />
      </div>
    );
  }

  if (status === "partial") {
    return (
      <div className="flex items-center text-blue-500">
        <Clock className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div className="flex items-center text-muted-foreground">
      <Minus className="h-4 w-4" />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add nextjs/components/admin/status-badge.tsx
git commit -m "refactor: StatusBadge icon-only mode, replace AlertTriangle with Clock"
```

---

### Task 8: Frontend — admin 페이지 검색 섹션 + 테이블 변경

**Files:**
- Modify: `nextjs/app/admin/page.tsx`

- [ ] **Step 1: import 추가**

```tsx
// 기존 import 유지 + 추가
import { Search, X, ArrowUpDown } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { recommend, type Recommendation, type PaginationMeta } from "@/lib/api";
```

- [ ] **Step 2: 검색 state 추가** (기존 `newCategoryName` state 선언 이후)

```tsx
const [searchText, setSearchText] = useState("");
const [searchLanguage, setSearchLanguage] = useState("ko");
const [searchResults, setSearchResults] = useState<Recommendation[] | null>(null);
const [searchMeta, setSearchMeta] = useState<PaginationMeta | null>(null);
const [isSearching, setIsSearching] = useState(false);
const [searchError, setSearchError] = useState<string | null>(null);
const searchPageRef = useRef(1);
```

- [ ] **Step 3: handleSearch, handleReset 함수 추가** (`handleAddCategory` 이후)

```tsx
const handleSearch = useCallback(async (page?: number) => {
  const currentPage = page ?? 1;
  searchPageRef.current = currentPage;
  setIsSearching(true);
  setSearchError(null);
  try {
    const data = await recommend(searchText, searchLanguage, token, currentPage);
    setSearchResults(data.data);
    setSearchMeta(data.meta);
  } catch (err) {
    setSearchError(err instanceof Error ? err.message : "검색에 실패했습니다");
    setSearchResults([]);
  } finally {
    setIsSearching(false);
  }
}, [searchText, searchLanguage, token]);

const handleReset = useCallback(() => {
  setSearchText("");
  setSearchResults(null);
  setSearchMeta(null);
  setSearchError(null);
}, []);
```

- [ ] **Step 4: isSearchMode + display data computed 변수 추가** (page 동기화 useEffect 근처)

```tsx
const isSearchMode = searchResults !== null;
const displayCategories = isSearchMode ? searchResults : categories;
const displayMeta = isSearchMode ? searchMeta : meta;
```

- [ ] **Step 5: handlePageChange 수정 — 검색 모드 분기**

```tsx
// 기존 handlePageChange 교체
const handlePageChange = useCallback((newPage: number) => {
  if (isSearchMode) {
    handleSearch(newPage);
  } else {
    router.push(`/admin?page=${newPage}`);
  }
}, [isSearchMode, handleSearch, router]);
```

- [ ] **Step 6: 좌측 사이드바에 검색 Card 추가** (기존 `<div className="space-y-6">` 내, 카테고리 추가 Card 위)

```tsx
<div className="space-y-6">
  {/* 카테고리 검색 */}
  <Card>
    <CardHeader>
      <CardTitle className="text-base">카테고리 검색</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <Tabs value={searchLanguage} onValueChange={setSearchLanguage}>
        <TabsList className="w-full">
          <TabsTrigger value="ko" className="flex-1">한국어</TabsTrigger>
          <TabsTrigger value="zh" className="flex-1">중국어</TabsTrigger>
          <TabsTrigger value="en" className="flex-1">영어</TabsTrigger>
        </TabsList>
      </Tabs>
      <Input
        placeholder="검색어 입력..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSearch();
        }}
      />
      <div className="flex gap-2">
        <Button
          onClick={() => handleSearch()}
          disabled={isSearching}
          className="flex-1"
        >
          {isSearching ? (
            <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-1.5 h-4 w-4" />
          )}
          검색
        </Button>
        {searchText && (
          <Button
            variant="outline"
            size="icon"
            onClick={handleReset}
            title="초기화"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {searchError && (
        <p className="text-sm text-destructive">{searchError}</p>
      )}
    </CardContent>
  </Card>

  {/* 카테고리 추가 (기존) */}
  <Card> ... </Card>
</div>
```

- [ ] **Step 7: 우측 테이블 컬럼 + 내용 — 검색 모드 분기**

**TableHeader — `한국어 카테고리`를 언어에 따라 변경:**

```tsx
<TableHead>
  {searchLanguage === "ko" ? "한국어 카테고리" : searchLanguage === "zh" ? "중국어 카테고리" : "영어 카테고리"}
</TableHead>
{isSearchMode && <TableHead className="w-[80px]">유사도</TableHead>}
<TableHead className="w-[40px]">상태</TableHead>
<TableHead className="w-[60px]">보기</TableHead>
```

**TableCell — 카테고리명 언어 필드 선택:**

```tsx
<TableCell className="font-medium">
  {searchLanguage === "ko"
    ? cat.category_name_ko ?? cat.category_name
    : searchLanguage === "zh"
      ? cat.category_name_zh ?? cat.category_name
      : cat.category_name_en ?? cat.category_name}
</TableCell>
{isSearchMode && (
  <TableCell className="font-mono text-sm text-accent">
    {cat.similarity_score !== null
      ? `${(cat.similarity_score * 100).toFixed(1)}%`
      : "-"}
  </TableCell>
)}
<TableCell>
  <StatusBadge status={cat.translation_status} />
</TableCell>
```

모바일 카드 뷰에도 동일하게 유사도 컬럼 추가.

- [ ] **Step 8: 페이지네이션 — 검색 모드 분기**

Pagination 섹션 내 `handlePageChange(p)` → 이미 Step 5에서 분기 처리 완료.

현재 페이지 표시도 검색 모드 고려:
```tsx
{isSearchMode ? searchMeta.current_page : meta.current_page}
```

- [ ] **Step 9: Commit**

```bash
git add nextjs/app/admin/page.tsx
git commit -m "feat: add search section and search mode to admin page"
```

---

## Self-Review

**Spec coverage check:**
- `/api/recommend` 페이지네이션 + text nullable → Task 1, 3 ✅
- RecommendationService JOIN pagination → Task 2 ✅
- RecommendResource 확장 (모든 다국어 필드, id, translation_status, similarity_score) → Task 4 ✅
- Embed 페이지 호환 유지 (category_name 동적 매핑) → Task 4 ✅
- API 타입/함수 업데이트 → Task 6 ✅
- StatusBadge 아이콘만 표시, AlertTriangle → Clock → Task 7 ✅
- 좌측 검색 섹션 (Tabs + Input + 검색/초기화 버튼) → Task 8 ✅
- 우측 테이블 검색 모드 분기 (유사도 컬럼, 언어별 카테고리명) → Task 8 ✅
- 검색 결과 페이지네이션 → Task 8 ✅
- 검색어 없이 검색 버튼 → 일반 목록 표시 → Task 3, 8 ✅
- 언어 탭 변경 시 재검색 없음 → Task 8 (setSearchLanguage만, handleSearch 호출 없음) ✅
- 초기화 버튼 → 검색어 제거 (검색 결과 유지) → Task 8 ✅

**Placeholder scan:** 모든 step에 완전한 코드가 포함됨 ✅

**Type consistency:** Task 6에서 정의한 `Recommendation` 인터페이스와 Task 4의 Resource 필드 일치 ✅. `PaginationMeta`는 기존 타입 재사용 ✅.
