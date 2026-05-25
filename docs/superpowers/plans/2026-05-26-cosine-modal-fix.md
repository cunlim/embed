# CosineDetailDialog 언어별 유사도 수정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 코사인 유사도 모달 "언어별 유사도" 섹션의 3가지 이슈 수정 — 간격 확대, 수직 리스트+카테고리명, 언어별 실제 rank

**Architecture:** 백엔드에서 SQL `RANK() OVER (ORDER BY distance)` 윈도우 함수로 언어별 실제 rank 계산, Resource에서 이를 읽도록 변경, 프론트엔드는 그리드→수직 리스트로 레이아웃 변경

**Tech Stack:** Laravel 13 (PHP + pgvector), Next.js 16 (React 19, TypeScript, Tailwind CSS v4, shadcn/ui), Vitest, Pest

---

## 파일 구조

| 파일 | 역할 |
|------|------|
| `laravel/app/Services/RecommendationService.php` | pgvector JOIN 쿼리, 언어별 rank 윈도우 함수 추가 |
| `laravel/app/Http/Resources/RecommendResource.php` | rank를 모델 속성에서 읽도록 변경, 데드코드 제거 |
| `laravel/app/Http/Controllers/Api/RecommendController.php` | collection_index 주입 제거, 불필요한 static setter 호출 제거 |
| `laravel/tests/Feature/RecommendResourceTest.php` | 언어별 rank 독립 검증 |
| `nextjs/components/admin/cosine-detail-dialog.tsx` | UI: 간격, 수직 리스트, 카테고리명 표시 |
| `nextjs/components/admin/__tests__/cosine-detail-dialog.test.tsx` | 수직 리스트 렌더링, 카테고리명 표시 검증 |

---

### Task 1: RecommendationService — SQL 윈도우 함수로 rank 추가

**Files:**
- Modify: `laravel/app/Services/RecommendationService.php:62-115`

- [ ] **Step 1: selectRaw에 RANK() OVER (...) 추가**

```php
// 62-66행 기존 코드를 아래로 대체
$query = Category::select('categories.*')
    ->selectRaw('ce_ko.embedding <=> ?::vector as distance_ko', [$vectorLiteral])
    ->selectRaw('ce_en.embedding <=> ?::vector as distance_en', [$vectorLiteral])
    ->selectRaw('ce_zh.embedding <=> ?::vector as distance_zh', [$vectorLiteral])
    ->selectRaw('RANK() OVER (ORDER BY ce_ko.embedding <=> ?::vector) as rank_ko', [$vectorLiteral])
    ->selectRaw('RANK() OVER (ORDER BY ce_en.embedding <=> ?::vector) as rank_en', [$vectorLiteral])
    ->selectRaw('RANK() OVER (ORDER BY ce_zh.embedding <=> ?::vector) as rank_zh', [$vectorLiteral])
    ->selectRaw("ce_{$targetLanguage}.embedding::text as category_embedding_raw")
```

- [ ] **Step 2: map()에서 rank 속성 설정 추가**

```php
// 105-111행 foreach 블록 내부, similarity_score 설정 다음 줄에 추가
foreach (['ko', 'en', 'zh'] as $lang) {
    $dist = $category->{"distance_{$lang}"} ?? null;
    $category->{"similarity_score_{$lang}"} = $dist !== null
        ? round(1.0 - (float) $dist, 4)
        : null;
    // rank 속성 설정 (추가)
    $category->{"rank_{$lang}"} = $category->{"rank_{$lang}"} ?? null;
}
```

- [ ] **Step 3: Commit**

```bash
git add laravel/app/Services/RecommendationService.php
git commit -m "feat: recommendPaginated에 언어별 RANK() 윈도우 함수 추가"
```

---

### Task 2: RecommendResource — rank를 모델 속성에서 읽고 데드코드 제거

**Files:**
- Modify: `laravel/app/Http/Resources/RecommendResource.php`

- [ ] **Step 1: per_language_scores rank 변경 및 데드코드 제거**

`toArray()`에서:
```php
// 37행 — $itemIndex 제거
// 기존: $itemIndex = self::$pageOffset + $this->indexInCollection();
// 제거 (사용되지 않음)

// 44행 — rank 계산 변경
// 기존: 'rank' => $score !== null ? $itemIndex + 1 : null,
// 변경:
'rank' => $this->{"rank_{$l}"} ?? null,
```

또한 `$pageOffset`, `$targetLanguage` static 프로퍼티, `setPageOffset()`, `setTargetLanguage()`, `indexInCollection()` 메서드는 모두 데드코드가 된다. 제거한다:

```php
// 제거할 프로퍼티:
// private static int $pageOffset = 0;
// private static string $targetLanguage = 'ko';

// 제거할 메서드:
// public static function setPageOffset(int $page, int $perPage): void
// public static function setTargetLanguage(string $lang): void
// private function indexInCollection(): int
```

최종 파일:
```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RecommendResource extends JsonResource
{
    private static ?array $queryEmbedding = null;

    public static function setQueryEmbedding(?array $embedding): void
    {
        self::$queryEmbedding = $embedding;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $lang = $request->input('target_language', 'ko');

        $perLanguageScores = [];
        foreach (['ko', 'en', 'zh'] as $l) {
            $score = $this->{"similarity_score_{$l}"} ?? null;
            $perLanguageScores[$l] = [
                'similarity_score' => $score,
                'rank' => $this->{"rank_{$l}"} ?? null,
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

    private function parseCategoryEmbedding(): ?array
    {
        $raw = $this->category_embedding_raw ?? null;
        if ($raw === null) {
            return null;
        }
        if (is_array($raw)) {
            return $raw;
        }
        $decoded = json_decode((string) $raw, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        return null;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add laravel/app/Http/Resources/RecommendResource.php
git commit -m "refactor: RecommendResource - rank를 윈도우 함수 기반으로 변경, 데드코드 제거"
```

---

### Task 3: RecommendController — collection_index 주입 및 불필요 static setter 호출 제거

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/RecommendController.php:115-131`

- [ ] **Step 1: setPageOffset, setTargetLanguage 호출 및 collection_index 주입 제거**

```php
// 115-131행
// 기존:
// RecommendResource::setQueryEmbedding($searchLog->embedding->toArray());
// RecommendResource::setTargetLanguage($targetLanguage);
// RecommendResource::setPageOffset($page, $perPage);
//
// $results = $this->recommendation->recommendPaginated(
//     $searchLog, $targetLanguage, $perPage, $page, $scopeUserId, $keyword
// );
//
// $collection = $results->getCollection()->map(function ($item, $index) {
//     $item->collection_index = $index;
//     return $item;
// });
// $results->setCollection($collection);

// 변경:
RecommendResource::setQueryEmbedding($searchLog->embedding->toArray());

$results = $this->recommendation->recommendPaginated(
    $searchLog, $targetLanguage, $perPage, $page, $scopeUserId, $keyword
);
```

- [ ] **Step 2: Commit**

```bash
git add laravel/app/Http/Controllers/Api/RecommendController.php
git commit -m "refactor: RecommendController - collection_index 주입 및 불필요 static setter 호출 제거"
```

---

### Task 4: RecommendResourceTest — 언어별 rank 독립 검증

**Files:**
- Modify: `laravel/tests/Feature/RecommendResourceTest.php`

- [ ] **Step 1: rank 검증을 언어별 독립값으로 수정**

기존 테스트는 rank가 모두 1로 같았다 (collection_index=0 + pageOffset=0 → rank=1). 변경 후 rank는 모델에서 직접 제공되므로 테스트 데이터에 명시적 rank 설정:

```php
<?php

use App\Http\Resources\RecommendResource;
use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('RecommendResource includes per_language_scores with per-language rank', function () {
    $user = User::factory()->create();
    $category = Category::factory()->create(['user_id' => $user->id]);

    $embedding = array_fill(0, 1024, 0.1);
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

    RecommendResource::setQueryEmbedding($embedding);

    $category->similarity_score = 0.9876;
    $category->similarity_score_ko = 0.9876;
    $category->similarity_score_en = 0.8210;
    $category->similarity_score_zh = 0.7950;
    // 언어별 실제 rank (window function 결과 시뮬레이션)
    $category->rank_ko = 3;
    $category->rank_en = 8;
    $category->rank_zh = 20;

    $resource = new RecommendResource($category);
    $data = $resource->resolve(request()->merge(['target_language' => 'ko']));

    expect($data)->toHaveKey('per_language_scores');
    expect($data['per_language_scores'])->toBeArray();
    expect($data['per_language_scores']['ko'])->toMatchArray([
        'similarity_score' => 0.9876,
        'rank' => 3,
    ]);
    expect($data['per_language_scores']['en'])->toMatchArray([
        'similarity_score' => 0.8210,
        'rank' => 8,
    ]);
    expect($data['per_language_scores']['zh'])->toMatchArray([
        'similarity_score' => 0.7950,
        'rank' => 20,
    ]);
});

test('RecommendResource per_language_scores rank is null when score is null', function () {
    $user = User::factory()->create();
    $category = Category::factory()->create(['user_id' => $user->id]);

    RecommendResource::setQueryEmbedding(null);

    $category->similarity_score = null;
    $category->similarity_score_ko = null;
    $category->similarity_score_en = null;
    $category->similarity_score_zh = null;
    $category->rank_ko = null;
    $category->rank_en = null;
    $category->rank_zh = null;

    $resource = new RecommendResource($category);
    $data = $resource->resolve(request()->merge(['target_language' => 'ko']));

    expect($data['per_language_scores']['ko'])->toMatchArray([
        'similarity_score' => null,
        'rank' => null,
    ]);
});
```

- [ ] **Step 2: Run tests to verify pass**

```bash
docker exec cl_embed_laravel php artisan config:clear
docker exec cl_embed_laravel php artisan test --compact --filter=RecommendResourceTest
```

Expected: 2 tests PASS

- [ ] **Step 3: Commit**

```bash
git add laravel/tests/Feature/RecommendResourceTest.php
git commit -m "test: RecommendResourceTest 언어별 독립 rank 검증으로 갱신"
```

---

### Task 5: CosineDetailDialog — UI 변경 (간격, 수직 리스트, 카테고리명)

**Files:**
- Modify: `nextjs/components/admin/cosine-detail-dialog.tsx:268-321`

- [ ] **Step 1: 레이아웃 및 카테고리명 표시로 변경**

```tsx
// 268-321행 변경
{result.per_language_scores && (
  <>
    <Separator />

    <div className="space-y-2.5">
      <span className="text-xs font-medium">언어별 유사도</span>
      <div className="flex flex-col gap-2">
        {(
          [
            { code: "ko", label: "한국어", name: result.category_name_ko },
            { code: "en", label: "English", name: result.category_name_en },
            { code: "zh", label: "中文", name: result.category_name_zh },
          ] as const
        ).map(({ code, label, name }) => {
          const scores = result.per_language_scores![code];
          const isCurrent = code === targetLanguage;
          return (
            <div
              key={code}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2.5",
                isCurrent
                  ? "border-primary ring-2 ring-primary shadow-md"
                  : "border-muted-foreground/15 bg-muted/30"
              )}
            >
              <span
                className={cn(
                  "text-xs font-medium min-w-[42px]",
                  isCurrent ? "text-primary" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
              <span className="flex-1 min-w-0 truncate text-xs">
                {name ?? "—"}
              </span>
              <span
                className={cn(
                  "font-mono text-base font-bold tabular-nums",
                  !isCurrent && "text-muted-foreground"
                )}
              >
                {scores.similarity_score != null
                  ? `${(scores.similarity_score * 100).toFixed(1)}%`
                  : "—"}
              </span>
              <span
                className={cn(
                  "text-[11px] font-medium px-1.5 py-0.5 rounded",
                  isCurrent
                    ? "bg-primary/10 text-primary"
                    : "bg-muted/50 text-muted-foreground"
                )}
              >
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

- [ ] **Step 2: Commit**

```bash
git add nextjs/components/admin/cosine-detail-dialog.tsx
git commit -m "fix(embed): 언어별 유사도 레이아웃 수직 리스트로 변경 및 카테고리명 표시"
```

---

### Task 6: cosine-detail-dialog 테스트 갱신

**Files:**
- Modify: `nextjs/components/admin/__tests__/cosine-detail-dialog.test.tsx:112-161`

- [ ] **Step 1: mockResult에 서로 다른 rank 값 반영 및 테스트 수정**

mockResult는 이미 rank가 다르게 설정되어 있다 (ko=3, en=5, zh=8). 추가로 카테고리명 검증을 추가하고, grid 검증을 flex 검증으로 변경:

```tsx
describe("CosineDetailDialog rendering", () => {
  it("renders 3 language rows with category names", () => {
    render(
      <CosineDetailDialog
        open={true}
        onOpenChange={() => {}}
        result={mockResult}
        searchKeyword="search term"
        targetLanguage="ko"
      />
    );
    // 언어 라벨
    expect(screen.getByText("한국어")).toBeTruthy();
    expect(screen.getByText("English")).toBeTruthy();
    expect(screen.getByText("中文")).toBeTruthy();
    // 유사도 점수
    expect(screen.getByText("87.3%")).toBeTruthy();
    expect(screen.getByText("82.1%")).toBeTruthy();
    expect(screen.getByText("79.5%")).toBeTruthy();
    // 언어별 독립 rank
    expect(screen.getByText("3위")).toBeTruthy();
    expect(screen.getByText("5위")).toBeTruthy();
    expect(screen.getByText("8위")).toBeTruthy();
    // 카테고리명
    expect(screen.getByText("테스트")).toBeTruthy();
    expect(screen.getByText("Test")).toBeTruthy();
    expect(screen.getByText("测试")).toBeTruthy();
  });

  it("highlights current language with ring", () => {
    const { container } = render(
      <CosineDetailDialog
        open={true}
        onOpenChange={() => {}}
        result={mockResult}
        targetLanguage="ko"
      />
    );
    const ringElements = container.querySelectorAll(".ring-2");
    expect(ringElements.length).toBe(1);
  });

  it("hides language section when per_language_scores is null", () => {
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

  it("renders nothing when result is null", () => {
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

- [ ] **Step 2: Run tests to verify pass**

```bash
docker exec cl_embed_nextjs npm test -- --run
```

Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add nextjs/components/admin/__tests__/cosine-detail-dialog.test.tsx
git commit -m "test: cosine-detail-dialog 수직 리스트 및 카테고리명 검증 갱신"
```

---

### Task 7: 전체 검증

- [ ] **Step 1: 전체 검증 스크립트 실행**

```bash
# 메인 레포에서
.claude/hooks/run-all-checks.sh
```

Expected: tsc, lint, test, pint 모두 통과

- [ ] **Step 2: Pint 포맷팅**

```bash
docker exec cl_embed_laravel bash -c 'cp /var/www/html/app/Services/RecommendationService.php /tmp/ && vendor/bin/pint /tmp/RecommendationService.php && cp /tmp/RecommendationService.php /var/www/html/app/Services/'
docker exec cl_embed_laravel bash -c 'cp /var/www/html/app/Http/Resources/RecommendResource.php /tmp/ && vendor/bin/pint /tmp/RecommendResource.php && cp /tmp/RecommendResource.php /var/www/html/app/Http/Resources/'
docker exec cl_embed_laravel bash -c 'cp /var/www/html/app/Http/Controllers/Api/RecommendController.php /tmp/ && vendor/bin/pint /tmp/RecommendController.php && cp /tmp/RecommendController.php /var/www/html/app/Http/Controllers/Api/'
```

- [ ] **Step 3: 최종 commit (필요시)**
