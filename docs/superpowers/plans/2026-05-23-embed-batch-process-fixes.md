# Embed 일괄 처리 이슈 수정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** task-execution.tsx의 4가지 이슈(체크박스 해제/재실행 부재, 카테고리별 갱신 부재, 통계 기준 오류, 빈 큐 깜빡임)를 수정한다.

**Architecture:** `task-execution.tsx`의 `BatchProgress` 인터페이스를 확장하고, `onComplete` 콜백 시그니처를 `(wasStopped: boolean) => void`로 변경하여 중지/완료를 구분한다. `onCategoryComplete` 콜백을 추가해 카테고리 단위 갱신을 지원한다.

**Tech Stack:** React 19, TypeScript, Vitest + React Testing Library

---

### Task 1: `BatchProgress` 인터페이스 확장

**Files:**
- Modify: `nextjs/components/admin/task-execution.tsx`

- [ ] **Step 1: 인터페이스 변경**

`BatchProgress` 인터페이스를 다음과 같이 변경한다.

`task-execution.tsx:24-31` 영역:

```typescript
interface BatchProgress {
  totalCategories: number;
  completedCategories: number;
  failedCategories: number;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  currentCategory: string;
  currentStep: string;
  currentStepIndex: number;
  currentCategoryIndex: number;
  queueEmpty: boolean;
}
```

- `totalCategories` → `completedCategories` / `failedCategories` 추가
- `currentStepIndex` (1-based), `currentCategoryIndex` (1-based) 추가
- `queueEmpty: boolean` 추가

- [ ] **Step 2: tsc 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

인터페이스만 변경했으므로 기존 progress 참조부에서 타입 오류가 발생한다. 이후 Task에서 순차 해결.

---

### Task 2: Step 인덱스 트래킹 로직 구현

**Files:**
- Modify: `nextjs/components/admin/task-execution.tsx`

- [ ] **Step 1: executeQueue 내 progress 초기화부 수정**

Phase 1 초기 progress 설정 (`task-execution.tsx:76-83`)을 다음과 같이 변경:

```typescript
setProgress({
  totalCategories: targetCategoryIds.length,
  completedCategories: 0,
  failedCategories: 0,
  totalSteps: 0,
  completedSteps: 0,
  failedSteps: 0,
  currentCategory: "준비 중...",
  currentStep: "",
  currentStepIndex: 0,
  currentCategoryIndex: 0,
  queueEmpty: false,
});
```

- [ ] **Step 2: Phase 2 진입 시 progress 업데이트**

`queue.length === 0` 체크부 (line 109-113) 직전, queue가 비어있지 않을 때의 progress 설정을 변경:

```typescript
// queue.length > 0 일 때
const firstJob = queue[0];
setProgress({
  totalCategories: targetCategoryIds.length,
  completedCategories: 0,
  failedCategories: 0,
  totalSteps: queue.filter(j => j.categoryId === firstJob.categoryId).length,
  completedSteps: 0,
  failedSteps: 0,
  currentCategory: firstJob.categoryName,
  currentStep: firstJob.stepName,
  currentStepIndex: 1,
  currentCategoryIndex: 1,
  queueEmpty: false,
});
```

- [ ] **Step 3: Phase 2 step 실행 루프 수정**

루프에서 각 job 실행 시 `currentStepIndex`와 카테고리 전환 시 `currentCategoryIndex`를 갱신한다. `task-execution.tsx:125-150`:

```typescript
let catIdx = 1;
let prevCatId = queue[0]?.categoryId ?? 0;
const catStepTotals = new Map<number, number>();
const catStepCounts = new Map<number, number>();

// 각 카테고리별 총 step 수 계산
for (const job of queue) {
  catStepTotals.set(job.categoryId, (catStepTotals.get(job.categoryId) ?? 0) + 1);
}

for (const job of queue) {
  if (abortRef.current) break;

  // 카테고리 전환 감지
  if (job.categoryId !== prevCatId) {
    catIdx++;
    catStepCounts.set(prevCatId, catStepTotals.get(prevCatId) ?? 0);
    prevCatId = job.categoryId;
  }

  const stepNum = (catStepCounts.get(job.categoryId) ?? 0) + 1;
  catStepCounts.set(job.categoryId, stepNum);

  setProgress((p) =>
    p
      ? {
          ...p,
          currentCategory: job.categoryName,
          currentStep: job.stepName,
          currentStepIndex: stepNum,
          currentCategoryIndex: catIdx,
          totalSteps: catStepTotals.get(job.categoryId) ?? p.totalSteps,
        }
      : p,
  );

  try {
    const result = await runStep(job.categoryId, job.stepName, token);
    if (result.status === "completed") {
      setProgress((p) =>
        p ? { ...p, completedSteps: p.completedSteps + 1 } : p,
      );
    } else {
      setProgress((p) =>
        p ? { ...p, failedSteps: p.failedSteps + 1 } : p,
      );
    }
  } catch {
    setProgress((p) =>
      p ? { ...p, failedSteps: p.failedSteps + 1 } : p,
    );
  }

  // 카테고리의 마지막 step인지 확인 → completedCategories/failedCategories 갱신 + onCategoryComplete 호출
  const isLastStepOfCategory =
    (catStepCounts.get(job.categoryId) ?? 0) >= (catStepTotals.get(job.categoryId) ?? 0);

  if (isLastStepOfCategory) {
    const catFailed = (() => {
      // 현재 progress에서 failedSteps 확인 (step 단위 실패)
      let failed = false;
      setProgress((p) => {
        if (p) failed = p.failedSteps > 0;
        return p;
      });
      return failed;
    })();
    setProgress((p) =>
      p
        ? {
            ...p,
            completedCategories: p.completedCategories + (catFailed ? 0 : 1),
            failedCategories: p.failedCategories + (catFailed ? 1 : 0),
          }
        : p,
    );
    onCategoryComplete?.();
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add nextjs/components/admin/task-execution.tsx
git commit -m "feat: step 인덱스 및 카테고리별 통계 트래킹 구현"
```

---

### Task 3: 중지/재실행 기능 구현

**Files:**
- Modify: `nextjs/components/admin/task-execution.tsx`

- [ ] **Step 1: wasStopped 상태 및 targetIdsRef 추가**

컴포넌트 상단 state 선언부에 추가:

```typescript
const [wasStopped, setWasStopped] = useState(false);
const targetIdsRef = useRef<number[]>([]);
```

- [ ] **Step 2: handleStop 수정**

`handleStop` (line 196-198)을 다음과 같이 변경:

```typescript
const handleStop = useCallback(() => {
  abortRef.current = true;
  setWasStopped(true);
}, []);
```

- [ ] **Step 3: executeQueue에서 wasStopped 처리**

`executeQueue` 초입부에 `wasStopped` 초기화 및 `targetIdsRef` 저장:

```typescript
const executeQueue = useCallback(
  async (targetCategoryIds: number[]) => {
    setRunning(true);
    setError(null);
    setWasStopped(false);
    abortRef.current = false;
    targetIdsRef.current = targetCategoryIds;
    // ... 나머지
```

중지 감지 시 (`abortRef.current`) `onComplete(true)` 호출:

```typescript
if (abortRef.current) {
  // wasStopped는 handleStop에서 이미 true로 설정됨
  setRunning(false);
  onComplete(true);
  return;
}
```

정상 종료 시 `onComplete(false)` 호출:

```typescript
setRunning(false);
setWasStopped(false);
onComplete(false);
```

- [ ] **Step 4: handleRetry 추가**

```typescript
const handleRetry = useCallback(async () => {
  setWasStopped(false);
  await executeQueue(targetIdsRef.current);
}, [executeQueue]);
```

- [ ] **Step 5: UI 버튼 영역 수정**

버튼 배치를 실행 상태에 따라 변경 (`task-execution.tsx:206-235`):

```tsx
return (
  <Card className="p-4">
    <h3 className="mb-3 font-medium text-sm">작업 실행</h3>
    <div className="space-y-3">
      {/* 상단 버튼 */}
      <div className="flex gap-2">
        <Button
          onClick={handleSelectedProcess}
          disabled={running || selectedIds.size === 0}
          variant="outline"
          className="flex-1"
        >
          선택 처리
        </Button>
        <Button
          onClick={handleFullProcess}
          disabled={running}
          variant="outline"
          className="flex-1"
        >
          전체 처리
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Progress 영역 */}
      {progress && (
        <div className="space-y-2">
          {progress.queueEmpty ? (
            <p className="text-xs text-muted-foreground">처리할 단계가 없습니다</p>
          ) : (
            <>
              <Progress value={pct} />
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>
                  전체 {progress.totalCategories}개 / 완료 {progress.completedCategories}개 / 실패 {progress.failedCategories}개
                </p>
                {progress.currentCategory && (
                  <>
                    <p className="truncate">
                      현재 카테고리: &ldquo;{progress.currentCategory}&rdquo;
                    </p>
                    <p className="truncate">
                      현재: [{progress.currentStepIndex}/{progress.totalSteps}] {progress.currentStep}
                    </p>
                  </>
                )}
              </div>
            </>
          )}

          {/* 하단 중지/재실행 버튼 */}
          {running && (
            <Button
              onClick={handleStop}
              variant="destructive"
              className="w-full"
            >
              <Square className="mr-1.5 h-4 w-4" />
              실행중지
            </Button>
          )}
          {wasStopped && !running && (
            <Button
              onClick={handleRetry}
              variant="outline"
              className="w-full"
            >
              재실행
            </Button>
          )}
        </div>
      )}
    </div>
  </Card>
);
```

- [ ] **Step 6: Commit**

```bash
git add nextjs/components/admin/task-execution.tsx
git commit -m "feat: 중지/재실행 기능 구현 및 버튼 배치 변경"
```

---

### Task 4: 빈 큐 처리 (이미 처리 완료된 카테고리)

**Files:**
- Modify: `nextjs/components/admin/task-execution.tsx`

- [ ] **Step 1: queue.length === 0 분기 수정**

`task-execution.tsx:109-113`의 빈 큐 처리를 변경:

기존:
```typescript
if (queue.length === 0) {
  setRunning(false);
  setProgress(null);
  return;
}
```

변경:
```typescript
if (queue.length === 0) {
  setProgress((p) =>
    p
      ? {
          ...p,
          queueEmpty: true,
          completedCategories: p.totalCategories,
          currentCategory: "",
          currentStep: "",
        }
      : p,
  );
  setRunning(false);
  setWasStopped(false);
  onComplete(false);
  return;
}
```

- [ ] **Step 2: Commit**

```bash
git add nextjs/components/admin/task-execution.tsx
git commit -m "fix: 빈 큐 처리 시 진행상태 유지하도록 수정"
```

---

### Task 5: page.tsx 콜백 시그니처 변경

**Files:**
- Modify: `nextjs/app/embed/page.tsx`

- [ ] **Step 1: TaskExecutionProps에 onCategoryComplete 추가**

`task-execution.tsx`의 `TaskExecutionProps` 인터페이스:

```typescript
interface TaskExecutionProps {
  token: string | null;
  selectedIds: Set<number>;
  categories: (Category | Recommendation)[];
  filter: string | undefined;
  canModify: (cat: Category | Recommendation) => boolean;
  onComplete: (wasStopped: boolean) => void;
  onCategoryComplete?: () => void;
}
```

- [ ] **Step 2: page.tsx의 onComplete 콜백 수정**

`nextjs/app/embed/page.tsx:346-356`:

```tsx
<TaskExecution
  token={token}
  selectedIds={selectedIds}
  categories={displayCategories}
  filter={filter}
  canModify={canModify}
  onComplete={(wasStopped) => {
    if (!wasStopped) {
      setSelectedIds(new Set());
    }
    loadCategories(page, perPage, filter);
  }}
  onCategoryComplete={() => {
    loadCategories(page, perPage, filter);
  }}
/>
```

- [ ] **Step 3: Commit**

```bash
git add nextjs/app/embed/page.tsx nextjs/components/admin/task-execution.tsx
git commit -m "feat: onComplete 시그니처 변경 및 onCategoryComplete 추가"
```

---

### Task 6: 기존 테스트 갱신 및 신규 테스트

**Files:**
- Create: `nextjs/components/admin/__tests__/task-execution.test.tsx`
- Modify: `nextjs/app/embed/__tests__/page.test.tsx`

- [ ] **Step 1: TaskExecution 테스트 작성**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TaskExecution from "@/components/admin/task-execution";
import * as api from "@/lib/api";

vi.mock("@/lib/api", () => ({
  runStep: vi.fn(),
  getCategories: vi.fn(),
  fetchCategoryTranslations: vi.fn(),
}));

const mockToken = "test-token";
const mockCategories = [
  { id: 1, category_name_ko: "카테고리1", translation_status: "처리안됨", user_id: 1 },
  { id: 2, category_name_ko: "카테고리2", translation_status: "처리안됨", user_id: 1 },
] as any;

function createMockTranslations(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    category_code: "CAT1",
    category_name_ko: "카테고리1",
    category_name_en: null,
    category_name_zh: null,
    embedding_dimensions: 1024,
    languages: {
      ko: { translation_text: null, embedding: { status: "pending", preview: null }, ...overrides.ko },
      en: { translation_text: null, embedding: { status: "pending", preview: null }, ...overrides.en },
      zh: { translation_text: null, embedding: { status: "pending", preview: null }, ...overrides.zh },
    },
    ...overrides,
  };
}

describe("TaskExecution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("중지 버튼 클릭 시 wasStopped=true와 함께 onComplete 호출", async () => {
    const onComplete = vi.fn();
    // 무한 대기하는 runStep으로 실행 유지
    vi.mocked(api.fetchCategoryTranslations).mockResolvedValue({
      data: createMockTranslations(),
    });
    vi.mocked(api.runStep).mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    render(
      <TaskExecution
        token={mockToken}
        selectedIds={new Set([1])}
        categories={mockCategories}
        filter={undefined}
        canModify={() => true}
        onComplete={onComplete}
      />,
    );

    await userEvent.click(screen.getByText("선택 처리"));
    await waitFor(() => {
      expect(screen.getByText("실행중지")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("실행중지"));
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(true);
    });
  });

  it("정상 완료 시 wasStopped=false와 함께 onComplete 호출", async () => {
    const onComplete = vi.fn();
    vi.mocked(api.fetchCategoryTranslations).mockResolvedValue({
      data: createMockTranslations(),
    });
    vi.mocked(api.runStep).mockResolvedValue({ status: "completed", result: "ok" });

    render(
      <TaskExecution
        token={mockToken}
        selectedIds={new Set([1])}
        categories={mockCategories}
        filter={undefined}
        canModify={() => true}
        onComplete={onComplete}
      />,
    );

    await userEvent.click(screen.getByText("선택 처리"));
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(false);
    });
  });

  it("이미 처리 완료된 카테고리 선택 시 '처리할 단계가 없습니다' 표시", async () => {
    const onComplete = vi.fn();
    vi.mocked(api.fetchCategoryTranslations).mockResolvedValue({
      data: createMockTranslations({
        languages: {
          ko: { translation_text: "카테고리1", embedding: { status: "completed", preview: [0.1] } },
          en: { translation_text: "Category1", embedding: { status: "completed", preview: [0.2] } },
          zh: { translation_text: "分类1", embedding: { status: "completed", preview: [0.3] } },
        },
      }),
    });

    render(
      <TaskExecution
        token={mockToken}
        selectedIds={new Set([1])}
        categories={mockCategories}
        filter={undefined}
        canModify={() => true}
        onComplete={onComplete}
      />,
    );

    await userEvent.click(screen.getByText("선택 처리"));
    await waitFor(() => {
      expect(screen.getByText("처리할 단계가 없습니다")).toBeInTheDocument();
    });
    expect(onComplete).toHaveBeenCalledWith(false);
  });

  it("중지 후 재실행 버튼이 표시된다", async () => {
    const onComplete = vi.fn();
    vi.mocked(api.fetchCategoryTranslations).mockResolvedValue({
      data: createMockTranslations(),
    });
    vi.mocked(api.runStep).mockImplementation(
      () => new Promise(() => {}),
    );

    render(
      <TaskExecution
        token={mockToken}
        selectedIds={new Set([1])}
        categories={mockCategories}
        filter={undefined}
        canModify={() => true}
        onComplete={onComplete}
      />,
    );

    await userEvent.click(screen.getByText("선택 처리"));
    await waitFor(() => {
      expect(screen.getByText("실행중지")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("실행중지"));
    await waitFor(() => {
      expect(screen.getByText("재실행")).toBeInTheDocument();
    });
  });

  it("통계 표시가 카테고리 기준으로 출력된다", async () => {
    const onComplete = vi.fn();
    vi.mocked(api.fetchCategoryTranslations).mockResolvedValue({
      data: createMockTranslations(),
    });
    vi.mocked(api.runStep).mockResolvedValue({ status: "completed", result: "ok" });

    render(
      <TaskExecution
        token={mockToken}
        selectedIds={new Set([1])}
        categories={mockCategories}
        filter={undefined}
        canModify={() => true}
        onComplete={onComplete}
      />,
    );

    await userEvent.click(screen.getByText("선택 처리"));
    await waitFor(() => {
      // "전체 1개 / 완료 1개 / 실패 0개" 형식
      expect(screen.getByText(/전체 1개/)).toBeInTheDocument();
    });
  });

  it("step 인덱스가 [현재/전체] 형식으로 표시된다", async () => {
    const onComplete = vi.fn();
    vi.mocked(api.fetchCategoryTranslations).mockResolvedValue({
      data: createMockTranslations(),
    });
    vi.mocked(api.runStep).mockImplementation(
      () => new Promise(() => {}),
    );

    render(
      <TaskExecution
        token={mockToken}
        selectedIds={new Set([1])}
        categories={mockCategories}
        filter={undefined}
        canModify={() => true}
        onComplete={onComplete}
      />,
    );

    await userEvent.click(screen.getByText("선택 처리"));
    await waitFor(() => {
      // "[1/5] translation.en" 형식
      expect(screen.getByText(/\[1\/5\]/)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: 테스트 실행**

```bash
docker exec cl_embed_nextjs npm test -- --run
```

실패하는 테스트가 있는지 확인하고, 구현이 완료된 후 재실행.

- [ ] **Step 3: Commit**

```bash
git add nextjs/components/admin/__tests__/task-execution.test.tsx
git commit -m "test: TaskExecution 중지/재실행/통계/빈큐 테스트 추가"
```

---

### Task 7: run-all-checks.sh 실행 및 최종 검증

- [ ] **Step 1: run-all-checks.sh 실행**

```bash
.claude/hooks/run-all-checks.sh
```

통과 여부 확인. 실패 항목이 있으면 수정.

- [ ] **Step 2: Playwright로 embed 페이지 검증**

중지 후 체크박스 유지, 재실행 버튼, 통계 형식, 처리 완료 카테고리 선택 시 진행상태 유지 등을 확인.

---

### Task 8: 최종 커밋

- [ ] **Step 1: 모든 변경사항 확인 및 커밋**

```bash
git status
git diff --stat
git add -A
git commit -m "fix: embed 일괄 처리 4가지 이슈 수정"
```
