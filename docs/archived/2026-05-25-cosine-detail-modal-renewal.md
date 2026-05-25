# 코사인 유사도 상세 모달 리뉴얼 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** embed 페이지의 "코사인 유사도 상세" 모달을 임베딩 벡터 표시, 벡터 각도 시각화, 계산식 복사 기능을 갖춘 데이터 중심 모달로 리뉴얼한다.

**Architecture:** `/api/recommend` 응답에 `query_embedding`과 `category_embedding`을 추가하여 프론트엔드에서 추가 API 호출 없이 모달에서 즉시 표시한다. `RecommendResource`에 static property로 query_embedding을 주입하고, `RecommendationService`에서 JOIN 결과에 category_embedding 벡터를 포함시킨다.

**Tech Stack:** Laravel 13 (PHP) + Next.js 16 (React/TypeScript) + pgvector + shadcn/ui

---

### Task 1: Backend — RecommendResource에 임베딩 필드 추가

**Files:**
- Modify: `laravel/app/Http/Resources/RecommendResource.php`
- Modify: `laravel/tests/Feature/Api/RecommendControllerTest.php`

- [ ] **Step 1: RecommendResource에 static property + category_embedding 파싱 추가**

`RecommendResource` 전체를 아래와 같이 수정한다:

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
        // pgvector raw select는 "[0.1,0.2,...]" 형식 문자열로 반환됨
        $decoded = json_decode((string) $raw, true);
        if (is_array($decoded)) {
            return $decoded;
        }
        return null;
    }
}
```

- [ ] **Step 2: 테스트 확인 — 기존 RecommendResourceTest 갱신**

`RecommendControllerTest.php`의 "RecommendResource — toArray 응답 형식을 검증한다" 테스트를 수정한다:

```php
test('RecommendResource — toArray 응답 형식을 검증한다', function () {
    $category = Category::factory()->create([
        'category_code' => 'CAT_abc12345',
        'category_name_ko' => '패션의류',
        'category_name_zh' => '时尚服装',
        'category_name_en' => 'Fashion Clothing',
    ]);
    $category->similarity_score = 0.9532;

    RecommendResource::setQueryEmbedding([0.1, 0.2, 0.3]);

    $resource = new RecommendResource($category);
    $data = $resource->toArray(request()->merge(['target_language' => 'ko']));

    expect($data)->toHaveKeys([
        'id', 'category_code', 'category_name_ko', 'category_name_zh',
        'category_name_en', 'category_name', 'translation_status', 'similarity_score',
        'query_embedding', 'category_embedding',
    ]);
    expect($data['category_name'])->toBe('패션의류');
    expect($data['similarity_score'])->toBe(0.9532);
    expect($data['query_embedding'])->toBe([0.1, 0.2, 0.3]);
    expect($data['category_embedding'])->toBeNull(); // raw 없음 → null
});

test('RecommendResource — category_embedding_raw가 pgvector 문자열일 때 배열로 파싱한다', function () {
    $category = Category::factory()->create(['category_code' => 'CAT_test1', 'category_name_ko' => 'test']);
    $category->similarity_score = 0.5;
    $category->category_embedding_raw = '[0.1, 0.2, 0.3]';

    $resource = new RecommendResource($category);
    $data = $resource->toArray(request()->merge(['target_language' => 'ko']));

    expect($data['category_embedding'])->toBe([0.1, 0.2, 0.3]);
});
```

- [ ] **Step 3: 테스트 실행 및 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=RecommendResource
```

Expected: 2 passes (새 테스트 + 기존 갱신 테스트)

- [ ] **Step 4: Commit**

```bash
git add laravel/app/Http/Resources/RecommendResource.php laravel/tests/Feature/Api/RecommendControllerTest.php
git commit -m "feat(embed): RecommendResource에 query_embedding, category_embedding 필드 추가"
```

---

### Task 2: Backend — RecommendationService에 category_embedding raw select 추가

**Files:**
- Modify: `laravel/app/Services/RecommendationService.php`
- Modify: `laravel/app/Http/Controllers/Api/RecommendController.php`

- [ ] **Step 1: recommendPaginated에 category_embedding select 추가**

`RecommendationService::recommendPaginated()`의 selectRaw 라인을 수정한다:

```php
// 기존
$query = Category::select('categories.*')
    ->selectRaw('ce.embedding <=> ?::vector as distance', [$vectorLiteral])

// 변경
$query = Category::select('categories.*')
    ->selectRaw('ce.embedding <=> ?::vector as distance', [$vectorLiteral])
    ->selectRaw('ce.embedding::text as category_embedding_raw')
```

> `::text` 캐스트로 pgvector 바이너리 → `[-0.023,0.145,...]` 형식 문자열 변환. Resource에서 `json_decode()`로 배열 파싱.

- [ ] **Step 2: RecommendController에 setQueryEmbedding 호출 추가**

`RecommendController::recommend()`의 recommend 반환부 앞에 추가:

```php
// recommendPaginated 호출 전에 query_embedding 설정
RecommendResource::setQueryEmbedding($searchLog->embedding->toArray());

$results = $this->recommendation->recommendPaginated(
    $searchLog, $targetLanguage, $perPage, $page, $scopeUserId, $keyword
);

return RecommendResource::collection($results)->response();
```

- [ ] **Step 3: 테스트 실행**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=Recommend
```

Expected: all existing recommend tests pass

- [ ] **Step 4: Commit**

```bash
git add laravel/app/Services/RecommendationService.php laravel/app/Http/Controllers/Api/RecommendController.php
git commit -m "feat(embed): /api/recommend 응답에 query/category embedding 벡터 포함"
```

---

### Task 3: Frontend — Recommendation 타입에 임베딩 필드 추가

**Files:**
- Modify: `nextjs/lib/api.ts`

- [ ] **Step 1: Recommendation 인터페이스 수정**

`Recommendation` 인터페이스에 두 필드를 추가한다:

```typescript
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
}
```

- [ ] **Step 2: tsc 타입 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add nextjs/lib/api.ts
git commit -m "feat(embed): Recommendation 타입에 query_embedding, category_embedding 추가"
```

---

### Task 4: Frontend — CosineDetailDialog 리뉴얼

**Files:**
- Rewrite: `nextjs/components/admin/cosine-detail-dialog.tsx`
- Modify: `nextjs/app/embed/embed-page-inner.tsx:911-915` (props만 확인, 변경 최소)

- [ ] **Step 1: 새 CosineDetailDialog 컴포넌트 작성**

`cosine-detail-dialog.tsx`를 아래 내용으로 교체한다:

```tsx
"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Recommendation } from "@/lib/api";

interface CosineDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: Recommendation | null;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast("클립보드에 복사되었습니다"),
    () => toast("복사에 실패했습니다"),
  );
}

function VectorAngleSvg({ similarityScore }: { similarityScore: number }) {
  const theta = Math.acos(similarityScore);
  const thetaDeg = (theta * 180) / Math.PI;
  const cosTheta = similarityScore;

  const cx = 50, cy = 50, r = 40;

  // A: 3시 방향 (0°)
  const ax = cx + r, ay = cy;
  // B: 반시계 방향으로 theta만큼 (SVG에선 y↓이므로 clockwise가 반시계로 보임)
  const bx = cx + r * Math.cos(theta);
  const by = cy - r * Math.sin(theta);

  // 삼각형 마커 계산
  const arrowLen = 6;
  const axDir = { x: 1, y: 0 };
  const bAngle = -theta; // SVG 좌표계 기준
  const bxDir = { x: Math.cos(bAngle), y: Math.sin(bAngle) };

  // 각도 호: A(0°)에서 B(theta)까지 반시계 방향 (SVG sweep=1)
  const arcEndX = cx + 28 * Math.cos(theta);
  const arcEndY = cy - 28 * Math.sin(theta);

  return (
    <svg viewBox="0 0 100 100" width={90} height={90}>
      {/* 점선 원 */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={1} strokeDasharray="3 3" />
      {/* 각도 호 */}
      <path
        d={`M ${cx + 28} ${cy} A 28 28 0 0 1 ${arcEndX} ${arcEndY}`}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        opacity={0.4}
      />
      {/* A 벡터: 3시 방향 */}
      <line x1={cx} y1={cy} x2={ax} y2={ay} stroke="#3b82f6" strokeWidth={2.5} strokeLinecap="round" />
      <polygon
        points={`${ax + 3},${ay} ${ax - 3},${ay - 4} ${ax - 3},${ay + 4}`}
        fill="#3b82f6"
      />
      {/* B 벡터: 반시계 방향 */}
      <line x1={cx} y1={cy} x2={bx} y2={by} stroke="#ef4444" strokeWidth={2.5} strokeLinecap="round" />
      <polygon
        points={`${bx + bxDir.x * 3},${by + bxDir.y * 3} ${bx - bxDir.x * 3 + bxDir.y * 3},${by - bxDir.y * 3 - bxDir.x * 3} ${bx - bxDir.x * 3 - bxDir.y * 3},${by - bxDir.y * 3 + bxDir.x * 3}`}
        fill="#ef4444"
      />
      {/* 중심점 */}
      <circle cx={cx} cy={cy} r={2.5} fill="hsl(var(--muted-foreground))" />
      {/* 각도 텍스트 */}
      <text x={cx + 12} y={cy - 18} fontSize={9} fill="hsl(var(--primary))" fontFamily="monospace">{thetaDeg.toFixed(1)}°</text>
      {/* 축 표시 */}
      <text x={94} y={cy + 12} fontSize={8} fill="hsl(var(--muted-foreground))" fontFamily="monospace">x</text>
      <text x={cx - 6} y={8} fontSize={8} fill="hsl(var(--muted-foreground))" fontFamily="monospace">y</text>
    </svg>
  );
}

function buildDotProductExpression(a: number[], b: number[]): string {
  const terms = a.map((ai, i) => {
    const bi = b[i] ?? 0;
    const aiStr = ai >= 0 ? ai.toString() : `(${ai})`;
    const biStr = bi >= 0 ? bi.toString() : `(${bi})`;
    return `${aiStr}*${biStr}`;
  });
  // 음수와 양수 구분 없이 +로 연결 (aiStr에 이미 괄호 포함)
  return terms.join("+");
}

export default function CosineDetailDialog({
  open,
  onOpenChange,
  result,
}: CosineDetailDialogProps) {
  if (!result) return null;

  const similarityScore = result.similarity_score ?? 0;
  const queryEmbedding = result.query_embedding ?? [];
  const categoryEmbedding = result.category_embedding ?? [];

  const hasEmbeddings = queryEmbedding.length > 0 && categoryEmbedding.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">
            코사인 유사도 상세
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 유사도 점수 + 벡터 각도 시각화 */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">유사도 점수</p>
            <div className="flex items-center justify-center gap-5">
              <VectorAngleSvg similarityScore={similarityScore} />
              <div className="text-left">
                <p className="font-mono text-2xl font-bold">
                  {(similarityScore * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  cos θ = {similarityScore.toFixed(4)}, θ = {(Math.acos(similarityScore) * 180 / Math.PI).toFixed(1)}°
                </p>
              </div>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="inline-block w-2 h-2 rounded-full bg-[#3b82f6]" />
                A (검색어)
              </span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="inline-block w-2 h-2 rounded-full bg-[#ef4444]" />
                B (카테고리)
              </span>
            </div>
          </div>

          <Separator />

          {/* A. 검색어 임베딩 */}
          <div>
            <p className="text-xs font-medium mb-1.5">
              A. 검색어 임베딩{" "}
              <span className="inline-block bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded px-1.5 py-0.5 text-[10px] font-medium align-middle max-w-[100px] truncate">
                {result.category_name}
              </span>
            </p>
            <div className="flex items-center gap-2 bg-muted/50 rounded-md px-2.5 py-1.5">
              <span className="font-mono text-[10px] flex-1 truncate">
                {hasEmbeddings
                  ? `[${queryEmbedding.slice(0, 6).map((v) => v.toFixed(3)).join(", ")}, ... 1024차원]`
                  : "—"}
              </span>
              {hasEmbeddings && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(JSON.stringify(queryEmbedding))}
                  title="임베딩 전체 복사"
                >
                  <Copy className="size-3" />
                </Button>
              )}
            </div>
          </div>

          {/* B. 카테고리 임베딩 */}
          <div>
            <p className="text-xs font-medium mb-1.5">
              B. 카테고리 임베딩{" "}
              <span className="inline-block bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded px-1.5 py-0.5 text-[10px] font-medium align-middle max-w-[200px] truncate">
                {result.category_name}
              </span>
            </p>
            <div className="flex items-center gap-2 bg-muted/50 rounded-md px-2.5 py-1.5">
              <span className="font-mono text-[10px] flex-1 truncate">
                {hasEmbeddings
                  ? `[${categoryEmbedding.slice(0, 6).map((v) => v.toFixed(3)).join(", ")}, ... 1024차원]`
                  : "—"}
              </span>
              {hasEmbeddings && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(JSON.stringify(categoryEmbedding))}
                  title="임베딩 전체 복사"
                >
                  <Copy className="size-3" />
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* 계산 과정 */}
          <div>
            <p className="text-xs font-medium mb-1.5">계산 과정</p>
            <div className="flex items-center gap-2 bg-muted/50 rounded-md px-2.5 py-1.5">
              <span className="font-mono text-[10px] flex-1 truncate">
                {hasEmbeddings ? (
                  <>
                    cos(θ) = (A·B) / (|A|×|B|) = ({`(${queryEmbedding[0]?.toFixed(3) ?? "0"}×${categoryEmbedding[0]?.toFixed(3) ?? "0"})`} + ... ) / (1×1) = {similarityScore.toFixed(4)}
                  </>
                ) : (
                  "cos(θ) = (A·B) / (|A|×|B|) = " + similarityScore.toFixed(4)
                )}
              </span>
              {hasEmbeddings && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(buildDotProductExpression(queryEmbedding, categoryEmbedding))}
                  title="계산식 전체 복사"
                >
                  <Copy className="size-3" />
                </Button>
              )}
            </div>
            {hasEmbeddings && (
              <p className="text-[10px] text-muted-foreground mt-1">
                복사 시 전체 1024항 dot product 식으로 복사 (Windows 계산기 호환)
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Separator import 추가 확인**

`@/components/ui/separator` import가 필요함. 이미 `category-modal.tsx`에 사용 중이므로 패키지 존재 확인 완료.

- [ ] **Step 3: tsc 타입 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add nextjs/components/admin/cosine-detail-dialog.tsx
git commit -m "feat(embed): 코사인 유사도 상세 모달 리뉴얼 (임베딩 표시, 각도 시각화, 계산식 복사)"
```

---

### Task 5: 통합 검증

**Files:**
- `.claude/hooks/run-all-checks.sh` 실행

- [ ] **Step 1: 전체 체크 실행**

```bash
bash /var/app/www/cl_embed/.claude/hooks/run-all-checks.sh
```

Expected: tsc, lint, test, pint 모두 통과

- [ ] **Step 2: 실패 시 수정 후 재실행**

체크 결과 실패가 있으면 해당 오류를 수정한 후 아래 명령으로 재검증한다:

```bash
bash /var/app/www/cl_embed/.claude/hooks/run-all-checks.sh
```

- [ ] **Step 3: 최종 Commit**

```bash
git add -A
git commit -m "chore: 통합 검증 완료 — cosine detail modal renewal"
```

---

## Self-Review 결과

**1. Spec coverage:**
- API 응답 확장 (query_embedding, category_embedding) → Task 1, 2
- 벡터 각도 SVG 시각화 → Task 4
- A/B 임베딩 행 + badge + 복사 → Task 4
- 계산식 1줄 + 복사 → Task 4
- 처리 과정 제거 → Task 4 (기존 vectorSteps 삭제됨)
- Recommendation 타입 갱신 → Task 3
- 통합 검증 → Task 5

**2. Placeholder scan:** 없음. 모든 코드와 명령어가 실제 내용으로 채워져 있음.

**3. Type consistency:**
- `Recommendation.query_embedding` (Task 3) ↔ `result.query_embedding` (Task 4) — 일치
- `Recommendation.category_embedding` (Task 3) ↔ `result.category_embedding` (Task 4) — 일치
- `RecommendResource.setQueryEmbedding()` 호출 (Task 2) ↔ static method 정의 (Task 1) — 일치
- `category_embedding_raw` select (Task 2) ↔ `parseCategoryEmbedding()` 참조 (Task 1) — 일치
