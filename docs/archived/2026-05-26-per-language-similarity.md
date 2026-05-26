# CosineDetailDialog 언어별 유사도 표시 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CosineDetailDialog 모달 하단에 3개 언어(ko, en, zh)별 유사도 점수와 순위를 수평 3컬럼으로 표시하고, 현재 검색 언어를 ring/shadow로 강조한다.

**Architecture:** 백엔드에서 `RecommendationService::recommendPaginated()`가 3개 언어의 category_embeddings를 각각 LEFT JOIN하여 distance를 계산하고, `RecommendResource`가 `per_language_scores`(언어별 similarity_score + rank)를 응답에 추가한다. 프론트엔드는 `Recommendation` 타입을 확장하고 `CosineDetailDialog`에 3컬럼 UI를 추가하며, `targetLanguage` prop을 통해 현재 언어를 강조한다.

**Tech Stack:** Laravel 13 (PHP 8.4, pgvector), Next.js 16 (React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui)

---

### Task 1: RecommendationService - 3개 언어 LEFT JOIN 및 distance 계산

**Files:**
- Modify: `laravel/app/Services/RecommendationService.php:57-93`

- [ ] **Step 1: `recommendPaginated()`에 3개 언어 JOIN 및 distance selectRaw 추가**

`recommendPaginated()` 메서드의 `$query` 빌드 부분(62-68행)을 다음과 같이 변경한다:

```php
$query = Category::select('categories.*')
    ->selectRaw('ce_ko.embedding <=> ?::vector as distance_ko', [$vectorLiteral])
    ->selectRaw('ce_en.embedding <=> ?::vector as distance_en', [$vectorLiteral])
    ->selectRaw('ce_zh.embedding <=> ?::vector as distance_zh', [$vectorLiteral])
    ->selectRaw("ce_{$targetLanguage}.embedding::text as category_embedding_raw")
    ->leftJoin('category_embeddings as ce_ko', function ($join) {
        $join->on('ce_ko.category_id', '=', 'categories.id')
            ->where('ce_ko.language', '=', 'ko');
    })
    ->leftJoin('category_embeddings as ce_en', function ($join) {
        $join->on('ce_en.category_id', '=', 'categories.id')
            ->where('ce_en.language', '=', 'en');
    })
    ->leftJoin('category_embeddings as ce_zh', function ($join) {
        $join->on('ce_zh.category_id', '=', 'categories.id')
            ->where('ce_zh.language', '=', 'zh');
    });
```

`orderByRaw`와 paginate 직전의 `distance` 참조(82행)를 target language 기준으로 변경한다:

```php
$paginator = $query->orderByRaw("ce_{$targetLanguage}.embedding <=> ?::vector", [$vectorLiteral])
    ->paginate(perPage: $perPage, page: $page);
```

`map` 콜백(85-89행)에서 similarity_score 계산을 3개 언어 모두로 확장한다:

```php
$nameField = $this->nameFieldFor($targetLanguage);

$items = $paginator->getCollection()->map(function (Category $category) use ($targetLanguage, $nameField) {
    $category->similarity_score = round(1.0 - (float) ($category->distance_ko ?? 1.0), 4);
    // similarity_score는 targetLanguage 기준으로 overwrite
    $category->similarity_score = round(1.0 - (float) ($category->{"distance_{$targetLanguage}"} ?? 1.0), 4);
    $category->category_name = $category->{$nameField};

    // per-language scores 계산 (null이면 null)
    foreach (['ko', 'en', 'zh'] as $lang) {
        $dist = $category->{"distance_{$lang}"} ?? null;
        $category->{"similarity_score_{$lang}"} = $dist !== null
            ? round(1.0 - (float) $dist, 4)
            : null;
    }

    return $category;
});
```

- [ ] **Step 2: Docker executor로 pint 포맷팅 실행**

```bash
docker exec cl_embed_laravel bash -c 'cp /var/www/html/app/Services/RecommendationService.php /tmp/ && vendor/bin/pint /tmp/RecommendationService.php && cp /tmp/RecommendationService.php /var/www/html/app/Services/'
```

---

### Task 2: RecommendResource - per_language_scores 필드 추가

**Files:**
- Modify: `laravel/app/Http/Resources/RecommendResource.php:20-36`

- [ ] **Step 1: `toArray()`에 `per_language_scores` 추가**

`toArray()` 메서드의 반환 배열에 `per_language_scores` 키를 추가한다. rank는 페이지네이션 offset + 컬렉션 내 순서로 계산한다. `$this->resource`가 `LengthAwarePaginator` 안에서 Collection item으로 사용되므로, `$this->resource`가 Category 모델 인스턴스라고 가정한다. rank는 Resource 외부에서 전달받아야 하므로, static property로 page offset을 주입받는다.

```php
class RecommendResource extends JsonResource
{
    private static ?array $queryEmbedding = null;
    private static int $pageOffset = 0;
    private static string $targetLanguage = 'ko';

    public static function setQueryEmbedding(?array $embedding): void
    {
        self::$queryEmbedding = $embedding;
    }

    public static function setPageOffset(int $page, int $perPage): void
    {
        self::$pageOffset = ($page - 1) * $perPage;
    }

    public static function setTargetLanguage(string $lang): void
    {
        self::$targetLanguage = $lang;
    }

    public function toArray(Request $request): array
    {
        $lang = $request->input('target_language', 'ko');
        $itemIndex = self::$pageOffset + $this->indexInCollection();

        $perLanguageScores = [];
        foreach (['ko', 'en', 'zh'] as $l) {
            $score = $this->{"similarity_score_{$l}"} ?? null;
            $perLanguageScores[$l] = [
                'similarity_score' => $score,
                // rank = 1-based index within page (전체 rank는 pagination offset 보정)
                'rank' => $score !== null ? $itemIndex + 1 : null,
            ];
        }

        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'category_code' => $this->category_code,
            'category_name_ko' => $this->category_name_ko,
            'category_name_zh' => $this->category_name_zh,
            'category_name_en' => $this->category_name_en,
            'category_name' => $this->{"category_name_{$lang}"},
            'translation_status' => $this->translation_status,
            'similarity_score' => $this->similarity_score ?? null,
            'query_embedding' => self::$queryEmbedding,
            'category_embedding' => $this->parseCategoryEmbedding(),
            'per_language_scores' => $perLanguageScores,
        ];
    }

    /**
     * Collection item의 0-based index를 반환한다.
     * Resource collection 사용 시 자동으로 설정된다.
     */
    private function indexInCollection(): int
    {
        // Collection 내 index — AnonymousResourceCollection이 설정하지 않으므로
        // RecommendController에서 수동 주입하거나, 기본값 0 사용
        return 0;
    }
}
```

rank 계산이 복잡하므로, 더 단순한 접근으로 RecommendController에서 collection map 시 index를 주입한다:

**RecommendController 변경 (`recommend()` 메서드):**

```php
// paginate 호출 후
$page = $request->integer('page', 1);
$perPage = $request->integer('per_page', 20);
$offset = ($page - 1) * $perPage;

$paginator = $service->recommendPaginated($searchLog, $lang, $perPage, $page, $userId, $keyword);

RecommendResource::setTargetLanguage($lang);
$collection = $paginator->getCollection()->map(function ($item, $index) use ($offset) {
    $item->collection_index = $index;
    return $item;
});
$paginator->setCollection($collection);

return RecommendResource::collection($paginator)->response();
```

그리고 `RecommendResource::indexInCollection()`에서:

```php
private function indexInCollection(): int
{
    return $this->collection_index ?? 0;
}
```

- [ ] **Step 2: Docker executor로 pint 포맷팅**

```bash
docker exec cl_embed_laravel bash -c 'cp /var/app/www/html/app/Http/Resources/RecommendResource.php /tmp/ && vendor/bin/pint /tmp/RecommendResource.php && cp /tmp/RecommendResource.php /var/app/www/html/app/Http/Resources/'
docker exec cl_embed_laravel bash -c 'cp /var/app/www/html/app/Http/Controllers/Api/RecommendController.php /tmp/ && vendor/bin/pint /tmp/RecommendController.php && cp /tmp/RecommendController.php /var/app/www/html/app/Http/Controllers/Api/'
```

---

### Task 3: RecommendResourceTest - per_language_scores 검증

**Files:**
- Modify: `laravel/tests/Feature/RecommendResourceTest.php` (or create if not exists)

- [ ] **Step 1: 테스트 파일 확인 및 작성**

먼저 테스트 파일 존재 여부 확인:

```bash
ls laravel/tests/Feature/RecommendResourceTest.php 2>/dev/null || echo "NOT FOUND"
```

존재하면 수정, 없으면 생성한다. Pest 테스트:

```php
<?php

use App\Http\Resources\RecommendResource;
use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Models\SearchLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('RecommendResource includes per_language_scores', function () {
    $user = User::factory()->create();
    $category = Category::factory()->create(['user_id' => $user->id]);

    // 3개 언어 임베딩 생성
    $embedding = array_fill(0, 10, 0.1);
    CategoryEmbedding::factory()->create([
        'category_id' => $category->id,
        'language' => 'ko',
        'embedding' => $embedding,
    ]);
    CategoryEmbedding::factory()->create([
        'category_id' => $category->id,
        'language' => 'en',
        'embedding' => $embedding,
    ]);
    CategoryEmbedding::factory()->create([
        'category_id' => $category->id,
        'language' => 'zh',
        'embedding' => $embedding,
    ]);

    $searchLog = SearchLog::factory()->create([
        'keyword' => 'test',
        'embedding' => $embedding,
    ]);

    RecommendResource::setQueryEmbedding($embedding);
    RecommendResource::setPageOffset(1, 20);
    RecommendResource::setTargetLanguage('ko');

    $category->similarity_score = 0.9876;
    $category->similarity_score_ko = 0.9876;
    $category->similarity_score_en = 0.8210;
    $category->similarity_score_zh = 0.7950;
    $category->collection_index = 0;

    $resource = new RecommendResource($category);
    $data = $resource->resolve(request()->merge(['target_language' => 'ko']));

    expect($data)->toHaveKey('per_language_scores');
    expect($data['per_language_scores'])->toBeArray();
    expect($data['per_language_scores']['ko'])->toMatchArray([
        'similarity_score' => 0.9876,
        'rank' => 1,
    ]);
    expect($data['per_language_scores']['en'])->toMatchArray([
        'similarity_score' => 0.8210,
        'rank' => 1,
    ]);
});
```

- [ ] **Step 2: 테스트 실행**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=RecommendResourceTest
```

Expected: PASS

---

### Task 4: api.ts - LanguageScore, PerLanguageScores 타입 추가

**Files:**
- Modify: `nextjs/lib/api.ts:81-92`

- [ ] **Step 1: 타입 정의 추가**

`Recommendation` 인터페이스 위에 새 타입을 추가하고, `Recommendation`에 `per_language_scores` 필드를 추가한다:

```typescript
export interface LanguageScore {
  similarity_score: number | null;
  rank: number | null;
}

export interface PerLanguageScores {
  ko: LanguageScore;
  en: LanguageScore;
  zh: LanguageScore;
}

export interface Recommendation {
  id: number;
  category_code: string;
  category_name_ko: string;
  category_name_zh: string | null;
  category_name_en: string | null;
  category_name: string;
  translation_status: "completed" | "partial" | "pending";
  similarity_score: number | null;
  query_embedding: number[] | null;
  category_embedding: number[] | null;
  per_language_scores: PerLanguageScores | null;
}
```

---

### Task 5: CosineDetailDialog - 하단 3컬럼 UI + targetLanguage prop

**Files:**
- Modify: `nextjs/components/admin/cosine-detail-dialog.tsx:16-21,137-268`

- [ ] **Step 1: Props에 targetLanguage 추가**

```typescript
interface CosineDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: Recommendation | null;
  searchKeyword?: string;
  targetLanguage?: string;  // 'ko' | 'en' | 'zh'
}
```

컴포넌트 함수 시그니처에도 추가:

```typescript
export default function CosineDetailDialog({
  open,
  onOpenChange,
  result,
  searchKeyword,
  targetLanguage = "ko",
}: CosineDetailDialogProps) {
```

- [ ] **Step 2: Separator + 3컬럼 섹션을 계산 과정 아래에 추가**

계산 과정 섹션의 `</div>` 닫는 태그(263행)와 `</div>`(264행, `space-y-4` 종료) 사이에 추가한다. `per_language_scores`가 null이면 섹션을 표시하지 않는다.

```typescript
{result.per_language_scores && (
  <>
    <Separator />

    <div className="space-y-1.5">
      <span className="text-xs font-medium">언어별 유사도</span>
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            { code: "ko", label: "한국어" },
            { code: "en", label: "English" },
            { code: "zh", label: "中文" },
          ] as const
        ).map(({ code, label }) => {
          const scores = result.per_language_scores![code];
          const isCurrent = code === targetLanguage;
          return (
            <div
              key={code}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border px-3 py-3",
                isCurrent
                  ? "border-primary ring-2 ring-primary shadow-md"
                  : "border-muted-foreground/15 bg-muted/30"
              )}
            >
              <span
                className={cn(
                  "text-[11px] font-medium",
                  isCurrent ? "text-primary" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
              <span
                className={cn(
                  "font-mono text-lg font-bold tabular-nums",
                  !isCurrent && "text-muted-foreground"
                )}
              >
                {scores.similarity_score != null
                  ? `${(scores.similarity_score * 100).toFixed(1)}%`
                  : "—"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {scores.rank != null ? `${scores.rank}위` : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  </>
)}
```

`cn` import가 필요하므로 파일 상단에 추가:

```typescript
import { cn } from "@/lib/utils";
```

---

### Task 6: embed-page-inner - targetLanguage prop 전달

**Files:**
- Modify: `nextjs/app/embed/embed-page-inner.tsx:911-916`

- [ ] **Step 1: CosineDetailDialog에 targetLanguage prop 추가**

```typescript
<CosineDetailDialog
  open={cosineDialogOpen}
  onOpenChange={setCosineDialogOpen}
  result={activeResult}
  searchKeyword={searchText}
  targetLanguage={searchLanguage}
/>
```

---

### Task 7: cosine-detail-dialog.test.tsx - UI 렌더링 테스트 추가

**Files:**
- Modify: `nextjs/components/admin/__tests__/cosine-detail-dialog.test.tsx`

- [ ] **Step 1: 컴포넌트 렌더링 테스트 추가**

기존 유틸리티 함수 테스트 뒤에 컴포넌트 렌더링 테스트를 추가한다:

```typescript
import { render, screen } from "@testing-library/react";
import CosineDetailDialog from "@/components/admin/cosine-detail-dialog";
import type { Recommendation } from "@/lib/api";

const mockResult: Recommendation = {
  id: 1,
  category_code: "TEST",
  category_name_ko: "테스트",
  category_name_zh: "测试",
  category_name_en: "Test",
  category_name: "테스트",
  translation_status: "completed",
  similarity_score: 0.873,
  query_embedding: [0.1, -0.2, 0.3],
  category_embedding: [0.15, -0.18, 0.28],
  per_language_scores: {
    ko: { similarity_score: 0.873, rank: 3 },
    en: { similarity_score: 0.821, rank: 5 },
    zh: { similarity_score: 0.795, rank: 8 },
  },
};

describe("CosineDetailDialog 렌더링", () => {
  it("3개 언어 컬럼을 렌더링한다", () => {
    render(
      <CosineDetailDialog
        open={true}
        onOpenChange={() => {}}
        result={mockResult}
        searchKeyword="검색어"
        targetLanguage="ko"
      />
    );
    expect(screen.getByText("한국어")).toBeTruthy();
    expect(screen.getByText("English")).toBeTruthy();
    expect(screen.getByText("中文")).toBeTruthy();
    // 점수 표시 확인
    expect(screen.getByText("87.3%")).toBeTruthy();
    expect(screen.getByText("82.1%")).toBeTruthy();
    expect(screen.getByText("79.5%")).toBeTruthy();
    // 순위 표시 확인
    expect(screen.getByText("3위")).toBeTruthy();
    expect(screen.getByText("5위")).toBeTruthy();
    expect(screen.getByText("8위")).toBeTruthy();
  });

  it("현재 언어(ko)가 ring으로 강조된다", () => {
    const { container } = render(
      <CosineDetailDialog
        open={true}
        onOpenChange={() => {}}
        result={mockResult}
        targetLanguage="ko"
      />
    );
    // ring-2 클래스가 있는 요소 확인
    const ringElements = container.querySelectorAll(".ring-2");
    expect(ringElements.length).toBe(1);
  });

  it("per_language_scores가 null이면 언어별 섹션이 렌더링되지 않는다", () => {
    const resultWithoutScores = {
      ...mockResult,
      per_language_scores: null,
    };
    render(
      <CosineDetailDialog
        open={true}
        onOpenChange={() => {}}
        result={resultWithoutScores}
      />
    );
    expect(screen.queryByText("언어별 유사도")).toBeNull();
  });

  it("result가 null이면 아무것도 렌더링하지 않는다", () => {
    const { container } = render(
      <CosineDetailDialog
        open={true}
        onOpenChange={() => {}}
        result={null}
      />
    );
    expect(container.innerHTML).toBe("");
  });
});
```

- [ ] **Step 2: 테스트 실행**

```bash
docker exec cl_embed_nextjs npm test -- --run
```

Expected: 모두 PASS

---

### Task 8: 전체 검증

- [ ] **Step 1: `.claude/hooks/run-all-checks.sh` 실행**

```bash
.claude/hooks/run-all-checks.sh
```

이슈가 있으면 해결한다.

- [ ] **Step 2: 전체 테스트 통과 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact
docker exec cl_embed_nextjs npm test -- --run
```

Expected: 0 failures
