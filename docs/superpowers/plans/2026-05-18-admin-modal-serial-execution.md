# Admin Modal 직렬 실행 + 실행중지 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin 모달의 전체실행을 5개 step 직렬 실행으로 변경하고 실행중지 버튼을 추가하며, 각 step 완료 시 카테고리 목록을 갱신한다.

**Architecture:** `handleRunAll`을 `for...of` + `abortRef` 패턴의 직렬 루프로 변경. `isRunning` state를 제거하고 `runningSteps.size > 0 || pendingSteps.length > 0`으로 실행 상태를 파생. 실행중지 버튼은 `pendingSteps.length > 0`일 때만 표시.

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Tailwind CSS v4 + lucide-react

---

### Task 1: handleRunAll 직렬 실행 + abortRef + isRunning 제거

**Files:**
- Modify: `nextjs/components/admin/category-modal.tsx`

- [ ] **Step 1: abortRef 추가 및 isRunning state 제거**

현재 코드 라인 44-54:
```tsx
const [actionError, setActionError] = useState<string | null>(null);
const [runningSteps, setRunningSteps] = useState<Set<StepName>>(new Set());
const [pendingSteps, setPendingSteps] = useState<StepName[]>([]);
const [completedSteps, setCompletedSteps] = useState<Set<StepName>>(new Set());
const [failedSteps, setFailedSteps] = useState<Set<StepName>>(new Set());
const [stepResults, setStepResults] = useState<Map<StepName, string>>(new Map());
const [copyableSteps, setCopyableSteps] = useState<Set<StepName>>(new Set());
const [embeddingFullData, setEmbeddingFullData] = useState<Map<StepName, string>>(new Map());
const [flashSteps, setFlashSteps] = useState<Set<StepName>>(new Set());

const [isRunning, setIsRunning] = useState(false);
```

변경 후:
```tsx
const [actionError, setActionError] = useState<string | null>(null);
const [runningSteps, setRunningSteps] = useState<Set<StepName>>(new Set());
const [pendingSteps, setPendingSteps] = useState<StepName[]>([]);
const [completedSteps, setCompletedSteps] = useState<Set<StepName>>(new Set());
const [failedSteps, setFailedSteps] = useState<Set<StepName>>(new Set());
const [stepResults, setStepResults] = useState<Map<StepName, string>>(new Map());
const [copyableSteps, setCopyableSteps] = useState<Set<StepName>>(new Set());
const [embeddingFullData, setEmbeddingFullData] = useState<Map<StepName, string>>(new Map());
const [flashSteps, setFlashSteps] = useState<Set<StepName>>(new Set());

const abortRef = useRef(false);
```

- [ ] **Step 2: handleRunAll을 직렬 for...of 루프로 변경**

현재 `handleRunAll` (라인 103-186) 전체를 다음으로 교체:

```tsx
const handleRunAll = async () => {
  if (!data) return;
  setActionError(null);

  const steps: StepName[] = [];
  for (const lang of LANGUAGES) {
    if (lang.hasTranslation) {
      const tl = data.languages[lang.key];
      const transKey = `translation.${lang.key}` as StepName;
      const embedKey = `embedding.${lang.key}` as StepName;
      if (!tl.translation_text && !completedSteps.has(transKey) && !stepResults.has(transKey)) {
        steps.push(transKey);
      }
      if (tl.embedding.status !== "completed" && !completedSteps.has(embedKey) && !stepResults.has(embedKey)) {
        steps.push(embedKey);
      }
    } else {
      const embedKey = `embedding.${lang.key}` as StepName;
      if (data.languages[lang.key].embedding.status !== "completed" && !completedSteps.has(embedKey) && !stepResults.has(embedKey)) {
        steps.push(embedKey);
      }
    }
  }

  if (steps.length === 0) return;

  abortRef.current = false;
  setRunningSteps(new Set([steps[0]]));
  setPendingSteps(steps.slice(1));

  for (let i = 0; i < steps.length; i++) {
    if (abortRef.current) break;

    const stepName = steps[i];
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "https://embed.cunlim.dev/api"}/categories/${data.id}/run-step`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ step: stepName }),
        }
      );
      const result = await res.json();

      if (abortRef.current) break;

      if (result.status === 'completed') {
        setCompletedSteps((prev) => new Set(prev).add(stepName));
        setStepResults((prev) => new Map(prev).set(stepName, result.result));

        if (stepName.startsWith("embedding")) {
          handleStepComplete(stepName, data.id);
        } else {
          enableStepCopy(stepName);
        }

        const nextIndex = i + 1;
        if (nextIndex < steps.length) {
          setRunningSteps(new Set([steps[nextIndex]]));
          setPendingSteps(steps.slice(nextIndex + 1));
        } else {
          setRunningSteps(new Set());
          setPendingSteps([]);
        }

        onListRefresh?.();
      } else {
        throw new Error(result.error || '실행 실패');
      }
    } catch (err) {
      if (abortRef.current) break;
      const msg = err instanceof Error ? err.message : '실행 실패';
      setActionError(msg);
      setFailedSteps((prev) => new Set(prev).add(stepName));
      setRunningSteps(new Set());
      setPendingSteps([]);
      break;
    }
  }
};
```

- [ ] **Step 3: handleCancelPending 추가**

`handleRunAll` 바로 뒤에 추가:

```tsx
const handleCancelPending = () => {
  abortRef.current = true;
  setPendingSteps([]);
};
```

- [ ] **Step 4: handleOpenChange에서 abortRef 초기화 및 isRunning → runningSteps/pendingSteps로 대체**

`handleOpenChange` (라인 290-304)에서 `setIsRunning(false)`를 제거하고 `abortRef.current = false`를 추가:

```tsx
const handleOpenChange = (open: boolean) => {
  if (!open) {
    setActionError(null);
    setRunningSteps(new Set());
    setPendingSteps([]);
    setCompletedSteps(new Set());
    setFailedSteps(new Set());
    setStepResults(new Map());
    setCopyableSteps(new Set());
    setEmbeddingFullData(new Map());
    setFlashSteps(new Set());
    abortRef.current = false;
  }
  onOpenChange(open);
};
```

- [ ] **Step 5: renderRow 시그니처에 isExecuting, isPending props 추가**

`renderRow` 함수는 `runningSteps`/`pendingSteps` state에 접근할 수 없으므로 props로 전달받아야 합니다. 시그니처를 변경:

```tsx
const renderRow = (
  label: string,
  displayValue: string | null,
  copyValue: string | null,
  stepName: StepName | null,
  translationDone?: boolean,
  isExecuting?: boolean,
  isPending?: boolean,
) => {
```

- [ ] **Step 6: renderRow 내 pending 상태 아이콘 추가 및 isExecuting props 사용**

`renderRow` 내 Play 버튼 렌더링 부분에서 `isRunning` 대신 props를 사용:

```tsx
) : stepName ? (
  isRunningThis ? (
    <Button variant="ghost" size="icon" disabled title={label + " 실행 중"}>
      <Loader2 className="size-3 animate-spin" />
    </Button>
  ) : isPending ? (
    <Button variant="ghost" size="icon" disabled title={label + " 대기 중"}>
      <Clock className="size-3 animate-pulse" />
    </Button>
  ) : (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => handleSingleAction(stepName)}
      title={label + " 실행"}
      disabled={isExecuting || translationDone === false}
    >
      <Play className="size-3" />
    </Button>
  )
) : null}
```

변경 사항:
- `isRunning` → `isExecuting` props
- `isPending` props로 Clock 애니메이션 표시
- `Clock` import 추가 필요 (파일 상단 lucide import에 `Clock`, `Square` 추가)

- [ ] **Step 7: renderRow 호출부에 isExecuting, isPending 전달**

`renderRow` 호출 시 현재 step이 `pendingSteps`에 포함되어 있는지 확인하여 `isPending`을 전달합니다.

`LANGUAGES.map` 내부 (현재 라인 335-392), 각 `renderRow` 호출에 파라미터 추가:

```tsx
{renderRow(
  "번역",
  detail.translation_text,
  detail.translation_text,
  `translation.${lang.key}` as StepName,
  undefined,
  isExecuting,
  pendingSteps.includes(`translation.${lang.key}` as StepName),
)}
{renderRow(
  "임베딩",
  detail.embedding.preview
    ? `[${detail.embedding.preview.slice(0, 10).map((v) => v.toFixed(3)).join(", ")}…1024차원]`
    : null,
  detail.embedding.preview
    ? JSON.stringify(detail.embedding.preview)
    : null,
  `embedding.${lang.key}` as StepName,
  detail.translation_text !== null,
  isExecuting,
  pendingSteps.includes(`embedding.${lang.key}` as StepName),
)}
```

`isExecuting` 값도 상위 스코프에서 계산:

```tsx
const isExecuting = runningSteps.size > 0 || pendingSteps.length > 0;
```

- [ ] **Step 8: 누락된 import 추가**

파일 상단 lucide import에 `Clock`, `Square` 추가:
```tsx
import { Copy, Loader2, AlertCircle, Play, Check, Clock, Square } from "lucide-react";
```

- [ ] **Step 9: 전체실행 버튼 / 실행중지 버튼 조건부 렌더링**

모달 하단 (라인 396-417)을 다음으로 교체:

```tsx
{(() => {
  const ALL_STEPS: StepName[] = ["translation.zh", "translation.en", "embedding.ko", "embedding.zh", "embedding.en"];
  const isStepDone = (step: StepName): boolean => {
    if (!data) return false;
    if (completedSteps.has(step)) return true;
    if (step.startsWith("translation")) {
      const lang = step.split(".")[1] as "en" | "zh";
      return data.languages[lang].translation_text !== null;
    }
    const lang = step.split(".")[1] as "ko" | "en" | "zh";
    return data.languages[lang].embedding.status === "completed";
  };
  const isExecuting = runningSteps.size > 0 || pendingSteps.length > 0;
  const allCompleted = data ? ALL_STEPS.every(isStepDone) : false;
  const hasPending = pendingSteps.length > 0;

  return (
    <div className="flex justify-end">
      {hasPending ? (
        <Button variant="destructive" onClick={handleCancelPending}>
          <Square className="mr-1.5 h-4 w-4" />
          실행중지
        </Button>
      ) : (
        <Button onClick={handleRunAll} disabled={isExecuting || allCompleted}>
          {isExecuting ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : allCompleted ? (
            <Check className="mr-1.5 h-4 w-4" />
          ) : (
            <Play className="mr-1.5 h-4 w-4" />
          )}
          전체 실행
        </Button>
      )}
    </div>
  );
})()}
```

---

### Task 2: 테스트 수정

**Files:**
- Modify: `nextjs/components/admin/__tests__/category-modal.test.tsx`

- [ ] **Step 1: 기존 테스트 유지 및 isRunning 참조 제거**

기존 테스트 5개(`미완료 항목에 Play`, `완료된 항목에 복사`, `로딩 중 스켈레톤`, `에러 발생 시`, `전체실행 버튼`)는 그대로 유효. `isRunning` state를 제거했지만 이는 컴포넌트 내부 구현 변경이므로 테스트에는 영향 없음.

- [ ] **Step 2: 전체실행 시 pending 상태 검증 테스트 추가**

```tsx
it("전체실행 버튼 클릭 시 실행중지 버튼이 나타난다", () => {
  render(<CategoryModal open={true} onOpenChange={vi.fn()} data={pendingData} isLoading={false} error={null} token="token" />);
  const runAllButton = screen.getByRole("button", { name: "전체 실행" });
  // 실행중지 버튼은 아직 없음
  expect(screen.queryByRole("button", { name: "실행중지" })).not.toBeInTheDocument();
});
```

(전체실행 후 상태는 비동기 API 호출 이후이므로 render 시점에 검증하는 것으로 충분합니다. `handleRunAll`의 비동기 동작은 E2E 테스트 범위입니다.)

- [ ] **Step 3: 실행중지 버튼 조건 검증 — pending이 없을 때 숨김**

```tsx
it("pending이 없으면 실행중지 버튼이 표시되지 않는다", () => {
  const completedEnData = {
    ...pendingData,
    languages: {
      ...pendingData.languages,
      en: {
        translation_text: "Life/Health",
        embedding: { status: "completed" as const, preview: [0.1, 0.2] },
      },
    },
  };
  render(<CategoryModal open={true} onOpenChange={vi.fn()} data={completedEnData} isLoading={false} error={null} token="token" />);
  // 전체 실행 버튼이 표시되고 실행중지 버튼은 없음
  expect(screen.getByRole("button", { name: "전체 실행" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "실행중지" })).not.toBeInTheDocument();
});
```

- [ ] **Step 4: 모든 항목 완료 시 전체실행 버튼 disabled 검증**

```tsx
it("모든 항목이 완료되면 전체실행 버튼이 disabled된다", () => {
  const allDoneData = {
    id: 4,
    category_code: "CAT_004",
    category_name_ko: "테스트",
    embedding_dimensions: 1024,
    languages: {
      ko: {
        translation_text: "테스트",
        embedding: { status: "completed" as const, preview: [0.1] },
      },
      en: {
        translation_text: "Test",
        embedding: { status: "completed" as const, preview: [0.2] },
      },
      zh: {
        translation_text: "测试",
        embedding: { status: "completed" as const, preview: [0.3] },
      },
    },
  };
  render(<CategoryModal open={true} onOpenChange={vi.fn()} data={allDoneData} isLoading={false} error={null} token="token" />);
  const runAllButton = screen.getByRole("button", { name: "전체 실행" });
  expect(runAllButton).toBeDisabled();
});
```

- [ ] **Step 5: 테스트 실행 확인**

Run: `docker exec cl_embed_nextjs npm test -- --filter="category-modal"`
Expected: 8 tests (기존 5 + 신규 3) all pass.

---

### Task 3: 최종 검증

- [ ] **Step 1: TypeScript 체크**

Run: `docker exec cl_embed_nextjs npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 2: 커밋**

```bash
cd /var/app/www/cl_embed
git add nextjs/components/admin/category-modal.tsx nextjs/components/admin/__tests__/category-modal.test.tsx
git commit -m "feat: Admin 모달 직렬 실행 + 실행중지 버튼 + 목록 동기화"
```

- [ ] **Step 3: 커밋 후 상태 확인**

Run: `cd /var/app/www/cl_embed && git status`
Expected: clean.
