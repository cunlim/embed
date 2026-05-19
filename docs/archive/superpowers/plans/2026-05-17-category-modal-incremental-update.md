# Category Modal Incremental Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카테고리 상세 모달에서 개별 번역/임베딩 실행 시 UI가 깨지지 않고, WebSocket 실시간 결과만으로 개별 row가 증분 갱신되도록 수정한다.

**Architecture:** WebSocket `CategoryProgress` 이벤트에 `result` 필드를 추가해 번역 텍스트/임베딩 preview를 함께 전달한다. 프론트엔드는 `stepResults` 로컬 상태로 결과를 누적하고, `onReload()`는 전체 pipeline 완료 시에만 호출한다. 버튼 UI는 `<Button>` 래퍼를 유지한 채 내부 아이콘만 `<Loader2>`로 교체한다.

**Tech Stack:** Laravel 13 + Pest 4 (backend), Next.js 16 + React 19 + TypeScript + Vitest (frontend)

---

### Task 1: CategoryProgress 이벤트에 result 필드 추가

**Files:**
- Modify: `laravel/app/Events/CategoryProgress.php`

- [ ] **Step 1: result 파라미터 추가**

```php
<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CategoryProgress implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $categoryId,
        public int $step,
        public string $stepName,
        public string $status,
        public ?string $error = null,
        public ?string $result = null,
    ) {}

    public function broadcastOn(): Channel
    {
        return new Channel("category.{$this->categoryId}");
    }

    public function broadcastAs(): string
    {
        return 'category.progress';
    }
}
```

- [ ] **Step 2: CategoryProgress 이벤트 테스트 업데이트**

Modify: `laravel/tests/Feature/Events/CategoryProgressTest.php`

기존 테스트 끝에 추가:

```php
test('CategoryProgress result property defaults to null', function () {
    $event = new CategoryProgress(1, 1, 'translation.zh', 'running');

    expect($event->result)->toBeNull();
});

test('CategoryProgress result property can be set', function () {
    $event = new CategoryProgress(1, 2, 'translation.en', 'completed', null, 'Sports/Leisure>Tennis>Tennis ball');

    expect($event->result)->toBe('Sports/Leisure>Tennis>Tennis ball');
});
```

- [ ] **Step 3: 테스트 실행 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryProgressTest
```

Expected: 6 passes (기존 4개 + 신규 2개)

- [ ] **Step 4: Commit**

```bash
git add laravel/app/Events/CategoryProgress.php laravel/tests/Feature/Events/CategoryProgressTest.php
git commit -m "feat: CategoryProgress 이벤트에 result 필드 추가"
```

---

### Task 2: Pipeline job에서 완료 시 result 전달

**Files:**
- Modify: `laravel/app/Jobs/CategoryTranslateEmbedPipeline.php`
- Modify: `laravel/tests/Feature/Jobs/CategoryTranslateEmbedPipelineTest.php`

- [ ] **Step 1: Pipeline job 수정**

`laravel/app/Jobs/CategoryTranslateEmbedPipeline.php`의 completed dispatch 부분을 수정한다.

**번역 완료 시** (line 123-128 근처):
```php
CategoryProgress::dispatch(
    $this->categoryId,
    $stepDef['step'],
    $stepDef['name'],
    'completed',
    null,
    $translated,  // result: 번역된 텍스트
);
```

**임베딩 완료 시** (같은 영역, else 분기):
```php
CategoryProgress::dispatch(
    $this->categoryId,
    $stepDef['step'],
    $stepDef['name'],
    'completed',
    null,
    json_encode(array_slice($vector->toArray(), 0, 10)),  // result: 첫 10개 값 JSON
);
```

**smart resume skip 시** (line 77-85 근거):
```php
CategoryProgress::dispatch(
    $this->categoryId,
    $stepDef['step'],
    $stepDef['name'],
    'completed',
    null,
    null,  // 이미 완료된 단계는 result 없음 (프론트엔드가 data prop에서 조회)
);
```

- [ ] **Step 2: Pipeline 테스트 업데이트**

`laravel/tests/Feature/Jobs/CategoryTranslateEmbedPipelineTest.php`의 `5단계 순서대로 진행 이벤트를 broadcast 한다` 테스트에서 completed 이벤트에 result가 포함되는지 검증:

```php
// 기존 테스트의 completed assertion 수정 — result 필드 검증 추가
Event::assertDispatched(CategoryProgress::class, function (CategoryProgress $event) {
    return $event->stepName === 'translation.zh'
        && $event->step === 1
        && $event->status === 'completed'
        && $event->result === '번역됨';  // mock이 반환하는 값
});
```

나머지 completed assertion에도 동일 패턴으로 result 검증 추가.

- [ ] **Step 3: 테스트 실행 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryTranslateEmbedPipelineTest
```

Expected: all existing tests pass

- [ ] **Step 4: Commit**

```bash
git add laravel/app/Jobs/CategoryTranslateEmbedPipeline.php laravel/tests/Feature/Jobs/CategoryTranslateEmbedPipelineTest.php
git commit -m "feat: pipeline job에서 completed 시 result 데이터 전달"
```

---

### Task 3: useCategoryProgress 훅에 result 타입 추가

**Files:**
- Modify: `nextjs/hooks/useCategoryProgress.ts`

- [ ] **Step 1: CategoryProgress 인터페이스에 result 추가**

```typescript
export interface CategoryProgress {
  categoryId: number;
  step: number;
  stepName: StepName;
  status: StepStatus;
  error?: string;
  result?: string | null;
}
```

변경은 `error?: string;` 다음 줄에 `result?: string | null;` 한 줄 추가.

- [ ] **Step 2: Commit**

```bash
git add nextjs/hooks/useCategoryProgress.ts
git commit -m "feat: CategoryProgress 타입에 result 필드 추가"
```

---

### Task 4: category-modal 증분 업데이트 + UI 수정

**Files:**
- Modify: `nextjs/components/admin/category-modal.tsx`
- Modify: `nextjs/components/admin/__tests__/category-modal.test.tsx`

- [ ] **Step 1: 테스트 먼저 수정 (TDD)**

기존 테스트를 새 동작에 맞게 수정한다.

**변경 1**: "activeStep이 설정되면 해당 버튼 영역에 Loader2가 표시된다" 테스트를 수정 — 버튼이 사라지지 않고 버튼 내부에 Loader2가 있는지 확인:

```typescript
it("activeStep이 설정되면 버튼이 유지되고 내부 아이콘이 Loader2로 변경된다", () => {
  mockProgressDefault.isRunning = true;
  mockProgressDefault.activeStep = "translation.en";

  render(
    <CategoryModal
      open={true}
      onOpenChange={vi.fn()}
      data={pendingData}
      isLoading={false}
      error={null}
      token="token"
    />,
  );

  // 버튼은 여전히 존재해야 함 (사라지지 않음)
  const playButtons = screen.getAllByRole("button", { name: "번역 실행" });
  expect(playButtons.length).toBeGreaterThanOrEqual(1);
  
  // Loader2 아이콘이 버튼 내부에 존재 (animate-spin)
  const loaderIcons = document.querySelectorAll(".animate-spin");
  expect(loaderIcons.length).toBeGreaterThanOrEqual(1);
});
```

**변경 2**: "isRunning일 때 데이터 컬럼에 spinner가 표시되지 않는다" 테스트 추가:

```typescript
it("isRunning일 때 데이터 컬럼에는 spinner 대신 '처리전' 텍스트가 표시된다", () => {
  mockProgressDefault.isRunning = true;
  mockProgressDefault.activeStep = "translation.en";

  render(
    <CategoryModal
      open={true}
      onOpenChange={vi.fn()}
      data={pendingData}
      isLoading={false}
      error={null}
      token="token"
    />,
  );

  // 데이터 컬럼에 "처리전" 텍스트가 여전히 표시됨
  const pendingTexts = screen.getAllByText("처리전");
  expect(pendingTexts.length).toBeGreaterThanOrEqual(1);
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
docker exec cl_embed_nextjs npm test -- --run
```

Expected: 일부 테스트 실패 (UI 변경으로 인한 예상된 실패)

- [ ] **Step 3: category-modal.tsx 수정**

**변경 A** — `stepResults` 상태 추가 (line 44 근처):

```typescript
const [stepResults, setStepResults] = useState<Map<StepName, string>>(new Map());
```

**변경 B** — `handleProgressUpdate` 수정 (line 49-76):

```typescript
const handleProgressUpdate = useCallback((progress?: CategoryProgress) => {
  if (progress) {
    if (progress.status === "completed") {
      setCompletedSteps((prev) => new Set(prev).add(progress.stepName));
      setRunningSteps((prev) => {
        const next = new Set(prev);
        next.delete(progress.stepName);
        return next;
      });
      // 결과 저장 (개별 row 갱신용)
      if (progress.result) {
        let displayResult = progress.result;
        // 임베딩 결과는 JSON 배열 → 포맷팅하여 저장
        if (progress.stepName.startsWith("embedding")) {
          try {
            const arr = JSON.parse(progress.result) as number[];
            const dims = data?.embedding_dimensions ?? 1024;
            displayResult = `[${arr.map((v) => v.toFixed(3)).join(", ")}…${dims}차원]`;
          } catch { /* 파싱 실패 시 원본 저장 */ }
        }
        setStepResults((prev) => new Map(prev).set(progress.stepName, displayResult));
      }
    } else if (progress.status === "failed") {
      setFailedSteps((prev) => new Set(prev).add(progress.stepName));
      setRunningSteps((prev) => {
        const next = new Set(prev);
        next.delete(progress.stepName);
        return next;
      });
      if (progress.error) {
        setActionError(progress.error);
      }
    }
    // 개별 step 완료 시 onReload() 호출하지 않음 (목록은 갱신)
    onListRefresh?.();
  } else {
    // 전체 pipeline 완료 시에만 최종 동기화
    onReload?.();
    onListRefresh?.();
  }
}, [onReload, onListRefresh, data]);
```

**변경 C** — `renderRow` 수정 (line 126-173):

데이터 컬럼 (line 141-149):
```typescript
<span className="text-sm truncate font-mono">
  {hasValue ? (
    displayValue
  ) : stepName && stepResults.has(stepName) ? (
    stepResults.get(stepName)
  ) : isFailed ? (
    <span className="text-destructive italic">실패</span>
  ) : (
    <span className="text-muted-foreground italic">처리전</span>
  )}
</span>
```

데이터 컬럼에서 `isRunning`(전역)과 `isRunningThis`(개별) 체크를 모두 제거 — 실행 중에도 "처리전" 텍스트를 유지하고, 완료 시 `stepResults`의 값으로 대체된다.

액션 컬럼 (line 151-171) — 버튼 유지 + 내부 아이콘만 교체:
```typescript
<div>
  {isRunningThis ? (
    <Button variant="ghost" size="icon" disabled title={label + " 실행 중"}>
      <Loader2 className="size-3 animate-spin" />
    </Button>
  ) : isFailed ? (
    <AlertCircle className="size-4 text-destructive" />
  ) : isCompleted && copyValue ? (
    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(copyValue)} title="복사">
      <Copy className="size-3" />
    </Button>
  ) : stepName ? (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => handleSingleAction(stepName)}
      title={label + " 실행"}
      disabled={isRunning}
    >
      <Play className="size-3" />
    </Button>
  ) : null}
</div>
```

**변경 D** — 모달 닫힐 때 `stepResults` 초기화 (line 176-185):

```typescript
const handleOpenChange = (open: boolean) => {
  if (!open && isRunning) cancel();
  if (!open) {
    setActionError(null);
    setRunningSteps(new Set());
    setCompletedSteps(new Set());
    setFailedSteps(new Set());
    setStepResults(new Map());  // 추가
  }
  onOpenChange(open);
};
```

- [ ] **Step 4: 테스트 실행 확인**

```bash
docker exec cl_embed_nextjs npm test -- --run
```

Expected: 모든 테스트 통과

- [ ] **Step 5: ESLint + TypeScript 체크**

```bash
docker exec cl_embed_nextjs npm run lint
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add nextjs/components/admin/category-modal.tsx nextjs/components/admin/__tests__/category-modal.test.tsx
git commit -m "fix: 카테고리 모달 증분 업데이트 및 UI 깨짐 수정"
```

---

### Task 5: 최종 통합 검증

- [ ] **Step 1: Playwright로 실제 동작 확인**

```bash
# admin 페이지 접속 → 처리안됨 항목 상세 보기 → 개별 번역 실행 버튼 클릭
# 확인 사항:
# - 버튼이 사라지지 않고 아이콘만 spinner로 변경됨
# - 데이터 컬럼에 spinner가 표시되지 않음
# - 완료 후 해당 row만 갱신되고 모달 전체가 refresh 되지 않음
```

- [ ] **Step 2: 전체 테스트 통과 확인**

```bash
# Laravel
docker exec cl_embed_laravel php artisan test --compact

# Next.js
docker exec cl_embed_nextjs npm test -- --run
```

Expected: 0 failures

- [ ] **Step 3: Commit (if needed)**

```bash
git add -A
git commit -m "test: Playwright 통합 검증 완료"
```
