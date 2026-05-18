# Admin Modal Button Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 4 button state bugs in the admin category detail modal.

**Architecture:** All changes target a single file (`category-modal.tsx`). Fixes are: (1) remove Loader2 from run-all button, (2) check local state for embedding button disabled, (3) clear runningSteps on abort, (4) enable copy for embedding results.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest + RTL

---

### Task 1: Fix 1+3 — 전체실행 버튼 Loader2 제거 + abort 시 runningSteps 정리

**Files:**
- Modify: `nextjs/components/admin/category-modal.tsx`
- Test: `nextjs/components/admin/__tests__/category-modal.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to `category-modal.test.tsx`:

```tsx
describe("CategoryModal button fixes", () => {
  it("전체실행 버튼에 Loader2가 없어야 한다", () => {
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={pendingData} isLoading={false} error={null} token="token" />);
    const runAll = screen.getByRole("button", { name: "전체 실행" });
    // 전체실행 버튼에 Play 아이콘이 있어야 함 (Loader2의 animate-spin 클래스 미존재)
    const loader = runAll.querySelector(".animate-spin");
    expect(loader).toBeNull();
  });

  it("isExecuting=true일 때 전체실행 버튼은 disabled다", () => {
    // runningSteps에 step이 있으면 isExecuting=true
    // 버튼이 disabled되었는지 확인
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={pendingData} isLoading={false} error={null} token="token" />);
    // 실행 중인 step이 없는 기본 상태에서는 enabled
    const btn = screen.getByRole("button", { name: "전체 실행" });
    expect(btn).not.toBeDisabled();
  });

  it("전체완료 시 전체실행 버튼이 disabled된다", () => {
    const allDoneData = {
      id: 4,
      category_code: "CAT_004",
      category_name_ko: "테스트",
      embedding_dimensions: 1024,
      languages: {
        ko: { translation_text: "테스트", embedding: { status: "completed" as const, preview: [0.1] } },
        en: { translation_text: "Test", embedding: { status: "completed" as const, preview: [0.2] } },
        zh: { translation_text: "测试", embedding: { status: "completed" as const, preview: [0.3] } },
      },
    };
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={allDoneData} isLoading={false} error={null} token="token" />);
    const runAll = screen.getByRole("button", { name: "전체 실행" });
    expect(runAll).toBeDisabled();
    const checkIcon = runAll.querySelector("svg.lucide-check");
    expect(checkIcon).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker exec cl_embed_nextjs node node_modules/vitest/vitest.mjs run --reporter=verbose components/admin/__tests__/category-modal.test.tsx`

Expected: Tests pass (existing tests still pass, new test assertions may need adjustment)

- [ ] **Step 3: Fix 1 — Remove Loader2 from 전체실행 button**

In `category-modal.tsx` line ~441-449, change:

```tsx
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
```

To:

```tsx
{hasPending ? (
  <Button variant="destructive" onClick={handleCancelPending}>
    <Square className="mr-1.5 h-4 w-4" />
    실행중지
  </Button>
) : (
  <Button onClick={handleRunAll} disabled={isExecuting || allCompleted}>
    {allCompleted ? (
      <Check className="mr-1.5 h-4 w-4" />
    ) : (
      <Play className="mr-1.5 h-4 w-4" />
    )}
    전체 실행
  </Button>
)}
```

Also remove unused `Loader2` from import if no longer used elsewhere.

- [ ] **Step 4: Fix 3 — Clear runningSteps on abort**

In `handleRunAll`, add cleanup before each abort break:

```tsx
for (let i = 0; i < steps.length; i++) {
  if (abortRef.current) {
    setRunningSteps(new Set());
    setPendingSteps([]);
    break;
  }
  // ... step runs ...
  const result = await res.json();
  // ... process result ...
  onListRefresh?.();

  if (abortRef.current) {
    setRunningSteps(new Set());
    setPendingSteps([]);
    break;
  }

  const nextIndex = i + 1;
  if (nextIndex < steps.length) {
    setRunningSteps(new Set([steps[nextIndex]]));
    setPendingSteps(steps.slice(nextIndex + 1));
  } else {
    setRunningSteps(new Set());
    setPendingSteps([]);
  }
}
```

Also in the catch block:

```tsx
} catch (err) {
  if (abortRef.current) {
    setRunningSteps(new Set());
    setPendingSteps([]);
    break;
  }
  // ... existing error handling ...
}
```

- [ ] **Step 5: Run tests to verify**

Run: `docker exec cl_embed_nextjs node node_modules/vitest/vitest.mjs run --reporter=verbose components/admin/__tests__/category-modal.test.tsx`

Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add nextjs/components/admin/category-modal.tsx nextjs/components/admin/__tests__/category-modal.test.tsx docs/superpowers/specs/2026-05-18-admin-modal-fixes-design.md docs/superpowers/plans/2026-05-18-admin-modal-button-fixes.md
git commit -m "fix: 전체실행 버튼 Loader2 제거 및 실행중지 시 runningSteps 정리

- 전체실행 버튼에서 Loader2 제거, disabled만 유지
- handleRunAll abort 체크 지점에서 setRunningStates(new Set()) 호출로
  실행중지 후 로딩 스피너 멈추지 않는 버그 수정

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Fix 2+4 — 임베딩 버튼 disabled 조건 개선 + copyableSteps

**Files:**
- Modify: `nextjs/components/admin/category-modal.tsx`
- Test: `nextjs/components/admin/__tests__/category-modal.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
describe("CategoryModal embedding fixes", () => {
  it("번역 step 완료 후 임베딩 버튼 disabled가 해제된다", () => {
    // handleSingleAction으로 번역 완료 → completedSteps에 반영
    // 하지만 data prop의 translation_text는 null인 상태
    // 임베딩 버튼 disabled 조건에 completedSteps도 확인해야 함
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={pendingData} isLoading={false} error={null} token="token" />);
    // 최초: 임베딩 버튼은 disabled
    const embedBtns = screen.getAllByRole("button", { name: "임베딩 실행" });
    embedBtns.forEach(btn => expect(btn).toBeDisabled());
  });
});
```

- [ ] **Step 2: Run tests to verify**

Run: `docker exec cl_embed_nextjs node node_modules/vitest/vitest.mjs run --reporter=verbose components/admin/__tests__/category-modal.test.tsx`

Expected: Tests pass

- [ ] **Step 3: Fix 2 — Embedding button disabled checks local state**

In `renderRow` calls for embedding (lines ~379, ~404), change the `translationDone` prop:

Look for patterns like:
```tsx
renderRow(
  "임베딩",
  ...
  `embedding.${lang.key}` as StepName,
  detail.translation_text !== null,  // ← translationDone
  ...
)
```

Change the `translationDone` expression to also check local state. Since `renderRow` is called with `translationDone` and the step key is known, we can pass a function or computed boolean.

The cleanest approach: compute `translationDone` per language at the call site:

```tsx
const transKey = `translation.${lang.key}` as StepName;
const translationDone = detail.translation_text !== null 
  || completedSteps.has(transKey) 
  || stepResults.has(transKey);
```

Then pass `translationDone` instead of `detail.translation_text !== null`.

- [ ] **Step 4: Fix 4 — Embedding step also gets enableStepCopy**

In `handleRunAll` (line ~155-159), change:

```tsx
if (stepName.startsWith("embedding")) {
  handleStepComplete(stepName, data.id);
} else {
  enableStepCopy(stepName);
}
```

To:

```tsx
if (stepName.startsWith("embedding")) {
  handleStepComplete(stepName, data.id);
}
enableStepCopy(stepName);
```

Same change in `handleSingleAction` (line ~82-86):

```tsx
if (stepName.startsWith("embedding")) {
  handleStepComplete(stepName, data.id);
} else {
  enableStepCopy(stepName);
}
```

To:

```tsx
if (stepName.startsWith("embedding")) {
  handleStepComplete(stepName, data.id);
}
enableStepCopy(stepName);
```

- [ ] **Step 5: Run tests to verify**

Run: `docker exec cl_embed_nextjs node node_modules/vitest/vitest.mjs run --reporter=verbose components/admin/__tests__/category-modal.test.tsx`

Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add nextjs/components/admin/category-modal.tsx nextjs/components/admin/__tests__/category-modal.test.tsx
git commit -m "fix: 번역 후 임베딩 버튼 disabled 해제 및 임베딩 copyableSteps 추가

- embedding 버튼 disabled 조건에 completedSteps/stepResults 추가로
  번역 완료 후 disabled 해제
- embedding step 완료 시 enableStepCopy 호출하여 Check→Copy 전환

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: E2E 테스트 실행

- [ ] **Step 1: Run full test suite**

Run: `docker exec cl_embed_nextjs node node_modules/vitest/vitest.mjs run --reporter=verbose`

Expected: All tests pass

- [ ] **Step 2: Playwright 테스트로 수정 검증**

Navigate to admin page, open modal, run single translation, verify embedding button becomes enabled after completion.
