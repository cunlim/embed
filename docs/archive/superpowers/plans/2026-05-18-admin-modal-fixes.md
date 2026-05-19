# Admin 모달 이슈 3건 수정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin 페이지 카테고리 상세 모달의 3가지 이슈(TSC fail, 개별실행 목록 미반영, 모달 닫힘 시 상태 소멸)를 수정한다.

**Architecture:** `useCategoryExecution` 훅을 신규 생성하여 실행 상태와 로직을 부모 컴포넌트로 분리한다. CategoryModal은 props 기반 presentational 컴포넌트로 변경되어 모달 닫힘 시에도 상태가 유지된다. TSC 설정은 `.next`를 exclude에 추가하여 생성 파일의 오류를 무시한다.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Vitest + React Testing Library

---

### Task 1: TSC 설정 수정

**Files:**
- Modify: `nextjs/tsconfig.json:33`

- [ ] **Step 1: `.next`를 exclude에 추가**

수정 전:
```json
"exclude": ["node_modules"]
```

수정 후:
```json
"exclude": ["node_modules", ".next"]
```

- [ ] **Step 2: TSC 실행하여 통과 확인**

Run: `docker exec cl_embed_nextjs npx tsc --noEmit`
Expected: 종료 코드 0

---

### Task 2: `StepName` 타입을 `@/lib/api`로 이동

**Files:**
- Modify: `nextjs/lib/api.ts` — StepName 타입 추가
- Modify: `nextjs/components/admin/category-modal.tsx` — 로컬 StepName 제거, import로 대체

- [ ] **Step 1: `@/lib/api.ts`에 `StepName` 타입 추가**

```typescript
export type StepName = "translation.zh" | "translation.en" | "embedding.ko" | "embedding.zh" | "embedding.en";
```

- [ ] **Step 2: `category-modal.tsx`에서 로컬 `StepName` 제거**

```typescript
// 제거:
type StepName = "translation.zh" | "translation.en" | "embedding.ko" | "embedding.zh" | "embedding.en";

// 변경:
import type { CategoryTranslations, StepName } from "@/lib/api";
```

---

### Task 3: `useCategoryExecution` 훅 생성

**Files:**
- Create: `nextjs/hooks/useCategoryExecution.ts`
- Test: `nextjs/hooks/__tests__/useCategoryExecution.test.ts`

- [ ] **Step 1: `CatExecState` 인터페이스 정의 및 훅 구현**

`hooks/useCategoryExecution.ts`:
```typescript
"use client";

import { useRef, useCallback, useReducer } from "react";
import type { StepName, CategoryTranslations } from "@/lib/api";

export interface CatExecState {
  runningSteps: Set<StepName>;
  pendingSteps: StepName[];
  completedSteps: Set<StepName>;
  failedSteps: Set<StepName>;
  stepResults: Map<StepName, string>;
  copyableSteps: Set<StepName>;
  embeddingFullData: Map<StepName, string>;
  flashSteps: Set<StepName>;
  abortRef: { current: boolean };
  actionError: string | null;
}

export interface UseCategoryExecutionReturn {
  getState: (catId: number) => CatExecState;
  handleSingleAction: (
    catId: number,
    stepName: StepName,
    onListRefresh?: () => void,
  ) => Promise<void>;
  handleRunAll: (
    catId: number,
    data: CategoryTranslations,
    onListRefresh?: () => void,
  ) => Promise<void>;
  handleCancelPending: (catId: number) => void;
}

function createInitialState(): CatExecState {
  return {
    runningSteps: new Set(),
    pendingSteps: [],
    completedSteps: new Set(),
    failedSteps: new Set(),
    stepResults: new Map(),
    copyableSteps: new Set(),
    embeddingFullData: new Map(),
    flashSteps: new Set(),
    abortRef: { current: false },
    actionError: null,
  };
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useCategoryExecution(
  token: string | null,
): UseCategoryExecutionReturn {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const stateMapRef = useRef<Map<number, CatExecState>>(new Map());

  const getState = useCallback((catId: number): CatExecState => {
    if (!stateMapRef.current.has(catId)) {
      stateMapRef.current.set(catId, createInitialState());
    }
    return stateMapRef.current.get(catId)!;
  }, []);

  const handleSingleAction = useCallback(
    async (catId: number, stepName: StepName, onListRefresh?: () => void) => {
      const state = getState(catId);
      state.runningSteps = new Set(state.runningSteps).add(stepName);
      state.completedSteps.delete(stepName);
      state.failedSteps.delete(stepName);
      state.actionError = null;
      forceUpdate();

      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "https://embed.cunlim.dev/api";
        const res = await fetch(
          `${apiUrl}/categories/${catId}/run-step`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ step: stepName }),
          },
        );
        const result = await res.json();

        if (result.status === "completed") {
          state.completedSteps = new Set(state.completedSteps).add(stepName);
          state.stepResults = new Map(state.stepResults).set(
            stepName,
            result.result,
          );
          state.copyableSteps = new Set(state.copyableSteps);

          delayMs(2000).then(() => {
            state.copyableSteps.add(stepName);
            forceUpdate();
          });

          if (stepName.startsWith("embedding")) {
            try {
              const { fetchCategoryTranslations } = await import("@/lib/api");
              const res2 = await fetchCategoryTranslations(catId, token);
              const lang = stepName.split(".")[1] as "ko" | "en" | "zh";
              const emb = res2.data.languages[lang].embedding;
              if (emb.preview) {
                state.embeddingFullData = new Map(state.embeddingFullData).set(
                  stepName,
                  JSON.stringify(emb.preview),
                );
              }
            } catch {
              /* ignore */
            }
          }

          onListRefresh?.();
        } else {
          throw new Error(result.error || "실행 실패");
        }
      } catch (err) {
        state.failedSteps = new Set(state.failedSteps).add(stepName);
        state.actionError =
          err instanceof Error ? err.message : "실행 실패";
      } finally {
        const next = new Set(state.runningSteps);
        next.delete(stepName);
        state.runningSteps = next;
        forceUpdate();
      }
    },
    [token, getState],
  );

  const handleRunAll = useCallback(
    async (
      catId: number,
      data: CategoryTranslations,
      onListRefresh?: () => void,
    ) => {
      const state = getState(catId);
      state.actionError = null;

      const LANGUAGES: {
        key: "ko" | "en" | "zh";
        hasTranslation: boolean;
      }[] = [
        { key: "ko", hasTranslation: false },
        { key: "en", hasTranslation: true },
        { key: "zh", hasTranslation: true },
      ];

      const steps: StepName[] = [];
      for (const lang of LANGUAGES) {
        if (lang.hasTranslation) {
          const tl = data.languages[lang.key];
          const transKey = `translation.${lang.key}` as StepName;
          const embedKey = `embedding.${lang.key}` as StepName;
          if (
            !tl.translation_text &&
            !state.completedSteps.has(transKey) &&
            !state.stepResults.has(transKey)
          ) {
            steps.push(transKey);
          }
          if (
            tl.embedding.status !== "completed" &&
            !state.completedSteps.has(embedKey) &&
            !state.stepResults.has(embedKey)
          ) {
            steps.push(embedKey);
          }
        } else {
          const embedKey = `embedding.${lang.key}` as StepName;
          if (
            data.languages[lang.key].embedding.status !== "completed" &&
            !state.completedSteps.has(embedKey) &&
            !state.stepResults.has(embedKey)
          ) {
            steps.push(embedKey);
          }
        }
      }

      if (steps.length === 0) return;

      state.abortRef.current = false;
      state.runningSteps = new Set([steps[0]]);
      state.pendingSteps = steps.slice(1);
      forceUpdate();

      for (let i = 0; i < steps.length; i++) {
        if (state.abortRef.current) {
          state.runningSteps = new Set();
          state.pendingSteps = [];
          forceUpdate();
          break;
        }

        const stepName = steps[i];
        try {
          const apiUrl =
            process.env.NEXT_PUBLIC_API_URL || "https://embed.cunlim.dev/api";
          const res = await fetch(
            `${apiUrl}/categories/${catId}/run-step`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ step: stepName }),
            },
          );
          const result = await res.json();

          if (result.status === "completed") {
            state.completedSteps = new Set(state.completedSteps).add(stepName);
            state.stepResults = new Map(state.stepResults).set(
              stepName,
              result.result,
            );
            state.copyableSteps = new Set(state.copyableSteps);

            delayMs(2000).then(() => {
              state.copyableSteps.add(stepName);
              forceUpdate();
            });

            if (stepName.startsWith("embedding")) {
              try {
                const { fetchCategoryTranslations } = await import("@/lib/api");
                const res2 = await fetchCategoryTranslations(catId, token);
                const lang = stepName.split(".")[1] as "ko" | "en" | "zh";
                const emb = res2.data.languages[lang].embedding;
                if (emb.preview) {
                  state.embeddingFullData = new Map(
                    state.embeddingFullData,
                  ).set(stepName, JSON.stringify(emb.preview));
                }
              } catch {
                /* ignore */
              }
            }

            onListRefresh?.();
          } else {
            throw new Error(result.error || "실행 실패");
          }

          if (state.abortRef.current) {
            state.runningSteps = new Set();
            state.pendingSteps = [];
            forceUpdate();
            break;
          }

          const nextIndex = i + 1;
          if (nextIndex < steps.length) {
            state.runningSteps = new Set([steps[nextIndex]]);
            state.pendingSteps = steps.slice(nextIndex + 1);
          } else {
            state.runningSteps = new Set();
            state.pendingSteps = [];
          }
          forceUpdate();
        } catch (err) {
          if (state.abortRef.current) {
            state.runningSteps = new Set();
            state.pendingSteps = [];
            forceUpdate();
            break;
          }
          state.failedSteps = new Set(state.failedSteps).add(stepName);
          state.actionError =
            err instanceof Error ? err.message : "실행 실패";
          state.runningSteps = new Set();
          state.pendingSteps = [];
          forceUpdate();
          break;
        }
      }
    },
    [token, getState],
  );

  const handleCancelPending = useCallback(
    (catId: number) => {
      const state = getState(catId);
      state.abortRef.current = true;
      state.pendingSteps = [];
      forceUpdate();
    },
    [getState],
  );

  return {
    getState,
    handleSingleAction,
    handleRunAll,
    handleCancelPending,
  };
}
```

- [ ] **Step 2: 훅 테스트 작성**

`hooks/__tests__/useCategoryExecution.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCategoryExecution } from "@/hooks/useCategoryExecution";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useCategoryExecution", () => {
  it("getState는 신규 카테고리에 초기 상태를 반환한다", () => {
    const { result } = renderHook(() => useCategoryExecution("token"));
    const state = result.current.getState(1);
    expect(state.runningSteps.size).toBe(0);
    expect(state.pendingSteps).toEqual([]);
    expect(state.completedSteps.size).toBe(0);
    expect(state.failedSteps.size).toBe(0);
    expect(state.stepResults.size).toBe(0);
    expect(state.copyableSteps.size).toBe(0);
    expect(state.embeddingFullData.size).toBe(0);
    expect(state.abortRef.current).toBe(false);
    expect(state.actionError).toBeNull();
  });

  it("getState는 같은 카테고리에 동일한 상태 참조를 반환한다", () => {
    const { result } = renderHook(() => useCategoryExecution("token"));
    const state1 = result.current.getState(1);
    const state2 = result.current.getState(1);
    expect(state1).toBe(state2);
  });

  it("getState는 다른 카테고리에 다른 상태를 반환한다", () => {
    const { result } = renderHook(() => useCategoryExecution("token"));
    const state1 = result.current.getState(1);
    const state2 = result.current.getState(2);
    expect(state1).not.toBe(state2);
  });

  it("handleSingleAction으로 step 완료 시 completedSteps에 추가된다", async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ status: "completed", result: "번역 결과" }),
    });

    const { result } = renderHook(() => useCategoryExecution("token"));

    await act(async () => {
      await result.current.handleSingleAction(1, "translation.en");
    });

    const state = result.current.getState(1);
    expect(state.runningSteps.size).toBe(0);
    expect(state.completedSteps.has("translation.en")).toBe(true);
    expect(state.stepResults.get("translation.en")).toBe("번역 결과");
  });

  it("handleSingleAction 실패 시 failedSteps에 추가된다", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useCategoryExecution("token"));

    await act(async () => {
      await result.current.handleSingleAction(1, "translation.zh");
    });

    const state = result.current.getState(1);
    expect(state.runningSteps.size).toBe(0);
    expect(state.failedSteps.has("translation.zh")).toBe(true);
  });

  it("handleCancelPending으로 abortRef가 설정된다", () => {
    const { result } = renderHook(() => useCategoryExecution("token"));

    act(() => {
      result.current.handleCancelPending(1);
    });

    expect(result.current.getState(1).abortRef.current).toBe(true);
  });
});
```

- [ ] **Step 3: 훅 테스트 실행**

Run: `docker exec cl_embed_nextjs npx vitest run hooks/__tests__/useCategoryExecution.test.ts`
Expected: 모든 테스트 통과

---

### Task 4: CategoryModal 리팩토링 — props 기반 전환

**Files:**
- Modify: `nextjs/components/admin/category-modal.tsx`
- Modify: `nextjs/components/admin/__tests__/category-modal.test.tsx`

- [ ] **Step 1: `CatExecState` import 추가 및 props 확장**

```typescript
import type { CatExecState } from "@/hooks/useCategoryExecution";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CategoryTranslations | null;
  isLoading: boolean;
  error: string | null;
  token?: string | null;
  onReload?: () => void;
  onListRefresh?: () => void;
  // New
  execState: CatExecState | null;
  onSingleAction: (stepName: StepName) => Promise<void>;
  onRunAll: () => Promise<void>;
  onCancelPending: () => void;
}
```

- [ ] **Step 2: 모든 내부 실행 state 및 로직 제거**

제거할 항목:
- `useState` 라인: `actionError`, `runningSteps`, `pendingSteps`, `completedSteps`, `failedSteps`, `stepResults`, `copyableSteps`, `embeddingFullData`, `flashSteps`
- `useRef`: `abortRef`
- 함수: `enableStepCopy`, `handleSingleAction`, `handleRunAll`, `handleCancelPending`, `handleStepComplete`

대체 — props에서 execState 추출:
```typescript
const execState = props.execState;
const runningSteps = execState?.runningSteps ?? new Set<StepName>();
const pendingSteps = execState?.pendingSteps ?? [];
const completedSteps = execState?.completedSteps ?? new Set<StepName>();
const failedSteps = execState?.failedSteps ?? new Set<StepName>();
const stepResults = execState?.stepResults ?? new Map<StepName, string>();
const copyableSteps = execState?.copyableSteps ?? new Set<StepName>();
const embeddingFullData = execState?.embeddingFullData ?? new Map<StepName, string>();
const flashSteps = execState?.flashSteps ?? new Set<StepName>();
const actionError = execState?.actionError ?? null;
```

- [ ] **Step 3: `handleOpenChange`에서 상태 리셋 제거**

수정 전:
```typescript
const handleOpenChange = (open: boolean) => {
  if (!open) {
    setActionError(null);
    setRunningSteps(new Set());
    // ... 전체 리셋
    abortRef.current = false;
  }
  onOpenChange(open);
};
```

수정 후:
```typescript
const handleOpenChange = (open: boolean) => {
  onOpenChange(open);
};
```

- [ ] **Step 4: 버튼 onClick을 props 콜백으로 연결**

```typescript
// 전체실행 버튼
onClick={handleRunAll} → onClick={props.onRunAll}

// 실행중지 버튼
onClick={handleCancelPending} → onClick={props.onCancelPending}

// 개별 실행 Play 버튼
onClick={() => handleSingleAction(stepName)} → onClick={() => props.onSingleAction(stepName)}
```

- [ ] **Step 5: `import` 정리 — 사용하지 않는 훅 제거**

```typescript
// 수정 전
import { useState, useCallback, useRef } from "react";

// 수정 후  
import { useState, useCallback } from "react";
```

- [ ] **Step 6: Modal 테스트 업데이트 — 새 props 전달**

`category-modal.test.tsx`에 추가:
```typescript
import type { CatExecState } from "@/hooks/useCategoryExecution";
import { vi } from "vitest";

function createEmptyExecState(): CatExecState {
  return {
    runningSteps: new Set(),
    pendingSteps: [],
    completedSteps: new Set(),
    failedSteps: new Set(),
    stepResults: new Map(),
    copyableSteps: new Set(),
    embeddingFullData: new Map(),
    flashSteps: new Set(),
    abortRef: { current: false },
    actionError: null,
  };
}

const defaultHandlers = {
  onSingleAction: vi.fn().mockResolvedValue(undefined),
  onRunAll: vi.fn().mockResolvedValue(undefined),
  onCancelPending: vi.fn(),
};
```

모든 `render(<CategoryModal ... />)` 호출에 다음 props 추가:
```typescript
execState={createEmptyExecState()}
onSingleAction={defaultHandlers.onSingleAction}
onRunAll={defaultHandlers.onRunAll}
onCancelPending={defaultHandlers.onCancelPending}
```

---

### Task 5: admin/page.tsx — `useCategoryExecution` 적용

**Files:**
- Modify: `nextjs/app/admin/page.tsx`

- [ ] **Step 1: import 추가**

```typescript
import { useCategoryExecution } from "@/hooks/useCategoryExecution";
```

- [ ] **Step 2: 훅 사용 및 CategoryModal에 props 전달**

```typescript
const { getState, handleSingleAction, handleRunAll, handleCancelPending } =
  useCategoryExecution(token);

// CategoryModal에 전달
<CategoryModal
  open={modalCategoryId !== null}
  onOpenChange={(open) => {
    if (!open) setModalCategoryId(null);
  }}
  data={detailData}
  isLoading={detailLoading}
  error={detailError}
  token={token}
  onReload={reload}
  onListRefresh={() => loadCategories(page)}
  execState={modalCategoryId ? getState(modalCategoryId) : null}
  onSingleAction={async (stepName) => {
    if (modalCategoryId !== null) {
      await handleSingleAction(modalCategoryId, stepName, () => loadCategories(page));
    }
  }}
  onRunAll={async () => {
    if (modalCategoryId !== null && detailData) {
      await handleRunAll(modalCategoryId, detailData, () => loadCategories(page));
    }
  }}
  onCancelPending={() => {
    if (modalCategoryId !== null) {
      handleCancelPending(modalCategoryId);
    }
  }}
/>
```

---

### Task 6: 최종 검증

- [ ] **Step 1: TSC 체크**

Run: `docker exec cl_embed_nextjs npx tsc --noEmit`
Expected: 종료 코드 0

- [ ] **Step 2: 전체 테스트 실행**

Run: `docker exec cl_embed_nextjs sh -c "cd /app && node node_modules/vitest/vitest.mjs run --run"`
Expected: 모든 테스트 통과

---

### Task 7: 커밋

- [ ] **Step 1: 변경 파일 커밋**

```bash
git add docs/superpowers/plans/2026-05-18-admin-modal-fixes.md \
  nextjs/tsconfig.json \
  nextjs/lib/api.ts \
  nextjs/hooks/useCategoryExecution.ts \
  nextjs/hooks/__tests__/useCategoryExecution.test.ts \
  nextjs/components/admin/category-modal.tsx \
  nextjs/components/admin/__tests__/category-modal.test.tsx \
  nextjs/app/admin/page.tsx
git commit -m "$(cat <<'EOF'
feat: Admin 모달 이슈 3건 수정

- TSC fail: tsconfig.json exclude에 .next 추가
- 개별실행 목록 미반영: handleSingleAction에 onListRefresh 추가
- 모달 닫힘 시 상태 소멸: useCategoryExecution 훅으로 실행 상태 분리
  - CategoryModal presentational 전환
  - admin/page.tsx에서 훅 사용

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```
