# Admin Modal 버그 수정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin 카테고리 모달의 3가지 버그 수정 — 체크박스/뱃지 제거, 복사 toast 알림 + 전체값 복사, 실행 버튼 로딩 상태 + 결과 갱신

**Architecture:** `useCategoryProgress` 훅에 `activeStep` 상태와 `onUpdate` 콜백을 추가해 개별 step 로딩 추적 및 완료 후 데이터 재페칭을 구현. `CategoryModal`에서 sonner toast로 복사 알림을 제공하고, 표시값/복사값을 분리. 체크박스 제거로 UI 간소화.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest + React Testing Library, sonner (toast)

---

### Task 1: sonner 설치 및 <Toaster /> 추가

**Files:**
- Modify: `nextjs/app/layout.tsx:39-63`

- [ ] **Step 1: sonner 설치**

```bash
docker exec cl_embed_nextjs npx shadcn@latest add sonner
```

- [ ] **Step 2: Root layout에 <Toaster /> 추가**

`nextjs/app/layout.tsx`의 `<ThemeProvider>` 내부에 `<Toaster />` 추가:

```tsx
import { Toaster } from "@/components/ui/sonner";

// ...

<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>
  <AppHeader />
  {children}
  <Toaster />
</ThemeProvider>
```

- [ ] **Step 3: Commit**

```bash
git add nextjs/app/layout.tsx nextjs/components/ui/sonner.tsx
git add nextjs/package.json nextjs/package-lock.json 2>/dev/null
git commit -m "feat(ui): sonner toast 추가 및 root layout에 Toaster 배치"
```

---

### Task 2: useCategoryProgress 훅 개선 (activeStep + onUpdate)

**Files:**
- Modify: `nextjs/hooks/useCategoryProgress.ts:1-124`
- Modify: `nextjs/hooks/__tests__/useCategoryProgress.test.ts:1-136`

- [ ] **Step 1: 테스트 수정 — activeStep, onUpdate 인터페이스 반영**

`nextjs/hooks/__tests__/useCategoryProgress.test.ts`를 전체 교체:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCategoryProgress } from "@/hooks/useCategoryProgress";

vi.mock("@/lib/api", () => ({
  translateEmbedCategory: vi.fn(),
  cancelTranslateEmbed: vi.fn(),
}));

const mockListen = vi.fn();
const mockLeaveChannel = vi.fn();
const mockChannel = vi.fn(() => ({
  listen: mockListen,
  stopListening: vi.fn(),
}));

const mockEcho = {
  channel: mockChannel,
  leaveChannel: mockLeaveChannel,
};

vi.mock("@/hooks/useEcho", () => ({
  useEcho: vi.fn(() => mockEcho),
}));

import { translateEmbedCategory } from "@/lib/api";

const mockedTranslateEmbed = translateEmbedCategory as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedTranslateEmbed.mockResolvedValue({
    message: "시작됨",
    category_id: 1,
  });
});

describe("useCategoryProgress", () => {
  it("초기 상태는 progress null, isRunning false, activeStep null", () => {
    const { result } = renderHook(() => useCategoryProgress());

    expect(result.current.progress).toBeNull();
    expect(result.current.isRunning).toBe(false);
    expect(result.current.activeStep).toBeNull();
  });

  it("subscribeProgress 호출 시 isRunning true, Echo 채널을 구독한다", () => {
    const { result } = renderHook(() => useCategoryProgress());

    act(() => {
      result.current.subscribeProgress(1);
    });

    expect(mockChannel).toHaveBeenCalledWith("category.1");
    expect(mockListen).toHaveBeenCalledTimes(2);
    expect(result.current.isRunning).toBe(true);
  });

  it("progress 이벤트 수신 시 progress + activeStep 상태를 업데이트한다", () => {
    const { result } = renderHook(() => useCategoryProgress());

    act(() => {
      result.current.subscribeProgress(1);
    });

    const progressCallback = mockListen.mock.calls.find(
      ([event]) => event === ".category.progress",
    )?.[1];

    act(() => {
      progressCallback({
        categoryId: 1,
        step: 1,
        stepName: "translation.zh",
        status: "running",
      });
    });

    expect(result.current.progress).toEqual({
      categoryId: 1,
      step: 1,
      stepName: "translation.zh",
      status: "running",
    });
    expect(result.current.activeStep).toBe("translation.zh");
  });

  it("completed 이벤트 수신 시 isRunning false, activeStep null, onUpdate 호출", () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useCategoryProgress(onUpdate));

    act(() => {
      result.current.subscribeProgress(1);
    });

    const completedCallback = mockListen.mock.calls.find(
      ([event]) => event === ".category.completed",
    )?.[1];

    act(() => {
      completedCallback({
        categoryId: 1,
        allSuccess: true,
        failedStep: 0,
      });
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.activeStep).toBeNull();
    expect(onUpdate).toHaveBeenCalled();
  });

  it("cancel 호출 시 채널 leave + 상태 초기화", async () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useCategoryProgress(onUpdate));

    act(() => {
      result.current.subscribeProgress(1);
    });

    act(() => {
      result.current.cancel();
    });

    expect(mockLeaveChannel).toHaveBeenCalledWith("category.1");
    expect(result.current.progress).toBeNull();
    expect(result.current.isRunning).toBe(false);
    expect(result.current.activeStep).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

```bash
docker exec cl_embed_nextjs npm test -- hooks/__tests__/useCategoryProgress.test.ts
```

`useCategoryProgress` 반환값에 `activeStep`이 없으므로 테스트 실패해야 함.

- [ ] **Step 3: useCategoryProgress 훅에 activeStep + onUpdate 추가**

`nextjs/hooks/useCategoryProgress.ts`를 전체 교체:

```ts
"use client";

import { useState, useCallback, useRef } from "react";
import { useEcho } from "@/hooks/useEcho";
import {
  translateEmbedCategory,
  cancelTranslateEmbed,
} from "@/lib/api";

export interface CategoryProgress {
  categoryId: number;
  step: number;
  stepName: StepName;
  status: StepStatus;
  error?: string;
}

export type StepName =
  | "translation.zh"
  | "translation.en"
  | "embedding.ko"
  | "embedding.zh"
  | "embedding.en";

export type StepStatus = "pending" | "running" | "completed" | "failed";

export interface CategoryPipelineCompleted {
  categoryId: number;
  allSuccess: boolean;
  failedStep: number;
}

export interface UseCategoryProgressReturn {
  progress: CategoryProgress | null;
  isRunning: boolean;
  activeStep: StepName | null;
  startTranslation: (categoryId: number, token?: string | null, steps?: string[]) => Promise<void>;
  subscribeProgress: (categoryId: number) => void;
  cancel: () => void;
}

export function useCategoryProgress(onUpdate?: () => void): UseCategoryProgressReturn {
  const echo = useEcho();
  const [progress, setProgress] = useState<CategoryProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeStep, setActiveStep] = useState<StepName | null>(null);
  const channelRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const categoryIdRef = useRef<number | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const subscribeProgress = useCallback(
    (categoryId: number) => {
      if (!echo) {
        console.warn("Echo 연결이 없습니다.");
        return;
      }

      setIsRunning(true);
      categoryIdRef.current = categoryId;

      const channelName = `category.${categoryId}`;
      channelRef.current = channelName;

      const channel = echo.channel(channelName);
      channel.listen(".category.progress", (data: CategoryProgress) => {
        setProgress(data);
        setActiveStep(data.stepName);
      });
      channel.listen(".category.completed", (_data: CategoryPipelineCompleted) => {
        setIsRunning(false);
        setActiveStep(null);
        onUpdateRef.current?.();
      });
    },
    [echo],
  );

  const startTranslation = useCallback(
    async (categoryId: number, token?: string | null, steps?: string[]) => {
      if (!echo) {
        console.warn("Echo 연결이 없습니다.");
        return;
      }

      tokenRef.current = token ?? null;

      if (categoryIdRef.current !== categoryId) {
        subscribeProgress(categoryId);
      }

      try {
        await translateEmbedCategory(categoryId, token, steps);
      } catch (err) {
        console.error("API 호출 실패:", err);
        setIsRunning(false);
        setActiveStep(null);
        if (channelRef.current) {
          echo.leaveChannel(channelRef.current);
        }
        throw err;
      }
    },
    [echo, subscribeProgress],
  );

  const cancel = useCallback(() => {
    const channelName = channelRef.current;
    const categoryId = categoryIdRef.current;

    if (channelName && echo) {
      echo.leaveChannel(channelName);
    }

    if (categoryId !== null) {
      cancelTranslateEmbed(categoryId, tokenRef.current).catch((err) => {
        console.error("Cancel API 호출 실패:", err);
      });
    }

    channelRef.current = null;
    categoryIdRef.current = null;
    tokenRef.current = null;
    setProgress(null);
    setIsRunning(false);
    setActiveStep(null);
  }, [echo]);

  return { progress, isRunning, activeStep, startTranslation, subscribeProgress, cancel };
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

```bash
docker exec cl_embed_nextjs npm test -- hooks/__tests__/useCategoryProgress.test.ts
```

Expected: 모든 5개 테스트 PASS.

- [ ] **Step 5: Commit**

```bash
git add nextjs/hooks/useCategoryProgress.ts nextjs/hooks/__tests__/useCategoryProgress.test.ts
git commit -m "feat(hook): useCategoryProgress에 activeStep + onUpdate 추가"
```

---

### Task 3: CategoryModal 버그 수정

**Files:**
- Modify: `nextjs/components/admin/category-modal.tsx:1-188`
- Create: `nextjs/components/admin/__tests__/category-modal.test.tsx`

- [ ] **Step 1: CategoryModal 테스트 작성**

`nextjs/components/admin/__tests__/category-modal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CategoryModal from "@/components/admin/category-modal";

// sonner toast mock
vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

// clipboard mock
const mockWriteText = vi.fn();
Object.assign(navigator, {
  clipboard: { writeText: mockWriteText },
});

import { toast } from "sonner";

const mockProgress = {
  progress: null,
  isRunning: false,
  activeStep: null as string | null,
  startTranslation: vi.fn(),
  subscribeProgress: vi.fn(),
  cancel: vi.fn(),
};

vi.mock("@/hooks/useCategoryProgress", () => ({
  useCategoryProgress: vi.fn(() => mockProgress),
}));

vi.mock("@/lib/api", () => ({
  translateEmbedCategory: vi.fn().mockResolvedValue({}),
}));

import { useCategoryProgress } from "@/hooks/useCategoryProgress";

const completedData = {
  id: 1,
  category_code: "CAT_test",
  category_name_ko: "테스트>카테고리",
  embedding_dimensions: 1024,
  languages: {
    ko: {
      translation_text: "테스트>카테고리",
      embedding: { status: "completed" as const, preview: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7] },
    },
    en: {
      translation_text: "Test>Category",
      embedding: { status: "completed" as const, preview: [0.1, 0.2, 0.3, 0.4, 0.5] },
    },
    zh: {
      translation_text: "测试>类别",
      embedding: { status: "completed" as const, preview: [0.1, 0.2, 0.3, 0.4, 0.5] },
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockProgress.isRunning = false;
  mockProgress.activeStep = null;
  mockWriteText.mockResolvedValue(undefined);
});

describe("CategoryModal", () => {
  it("언어 섹션에 체크박스가 없다", () => {
    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={completedData}
        isLoading={false}
        error={null}
        token="token"
      />,
    );

    const checkboxes = document.querySelectorAll('[role="checkbox"]');
    expect(checkboxes.length).toBe(0);
  });

  it("언어 헤더에 상태 뱃지가 없다", () => {
    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={completedData}
        isLoading={false}
        error={null}
        token="token"
      />,
    );

    expect(screen.queryByText("완료")).not.toBeInTheDocument();
  });

  it("완료된 항목에 복사 버튼이 표시된다", () => {
    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={completedData}
        isLoading={false}
        error={null}
        token="token"
      />,
    );

    const copyButtons = screen.getAllByRole("button", { name: "복사" });
    expect(copyButtons.length).toBeGreaterThan(0);
  });

  it("복사 버튼 클릭 시 clipboard에 쓰고 toast를 호출한다", () => {
    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={completedData}
        isLoading={false}
        error={null}
        token="token"
      />,
    );

    const copyButtons = screen.getAllByRole("button", { name: "복사" });
    fireEvent.click(copyButtons[0]);

    expect(mockWriteText).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("클립보드에 복사되었습니다");
  });

  it("임베딩 미완료 항목에 실행 버튼이 표시된다", () => {
    const pendingData = {
      ...completedData,
      languages: {
        ...completedData.languages,
        en: {
          translation_text: null,
          embedding: { status: "pending" as const, preview: null },
        },
      },
    };

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

    expect(screen.getByRole("button", { name: "번역 실행" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "임베딩 실행" })).toBeInTheDocument();
  });

  it("activeStep이 설정된 실행 버튼에 스피너가 표시된다", () => {
    mockProgress.isRunning = true;
    mockProgress.activeStep = "translation.en";

    const pendingData = {
      ...completedData,
      languages: {
        ...completedData.languages,
        en: {
          translation_text: null,
          embedding: { status: "pending" as const, preview: null },
        },
      },
    };

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

    // 번역 실행 버튼 대신 Loader2가 표시되어야 함
    const loaderIcons = document.querySelectorAll(".animate-spin");
    expect(loaderIcons.length).toBeGreaterThanOrEqual(2); // 값 영역 + 버튼 영역
  });

  it("전체 실행 버튼은 isRunning일 때 disabled만 적용된다 (스피너 없음)", () => {
    mockProgress.isRunning = true;
    mockProgress.activeStep = "translation.en";

    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={completedData}
        isLoading={false}
        error={null}
        token="token"
      />,
    );

    const runAllButton = screen.getByRole("button", { name: "전체 실행" });
    expect(runAllButton).toBeDisabled();
    // 스피너가 버튼 내에 없어야 함
    expect(runAllButton.querySelector(".animate-spin")).toBeNull();
  });

  it("에러 발생 시 에러 메시지가 표시된다", () => {
    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={completedData}
        isLoading={false}
        error="번역 API 호출 실패"
        token="token"
      />,
    );

    expect(screen.getByText("번역 API 호출 실패")).toBeInTheDocument();
  });

  it("로딩 중 스켈레톤이 표시된다", () => {
    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={null}
        isLoading={true}
        error={null}
        token="token"
      />,
    );

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("데이터 없고 로딩 아닐 때 아무것도 렌더링하지 않는다", () => {
    const { container } = render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={null}
        isLoading={false}
        error={null}
        token="token"
      />,
    );

    // Dialog는 렌더링되지만 내부 컨텐츠는 없어야 함
    expect(screen.queryByText("한국어 (ko)")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

```bash
docker exec cl_embed_nextjs npm test -- components/admin/__tests__/category-modal.test.tsx
```

현재 코드는 체크박스/뱃지가 있고, toast가 없으며, `activeStep`을 사용하지 않으므로 여러 테스트 실패.

- [ ] **Step 3: CategoryModal 수정**

`nextjs/components/admin/category-modal.tsx` 전체 교체:

```tsx
"use client";

import { useState } from "react";
import { Copy, Loader2, AlertCircle, Play } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryTranslations } from "@/lib/api";
import { translateEmbedCategory } from "@/lib/api";
import { useCategoryProgress } from "@/hooks/useCategoryProgress";
import type { StepName } from "@/hooks/useCategoryProgress";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CategoryTranslations | null;
  isLoading: boolean;
  error: string | null;
  token?: string | null;
  onReload?: () => void;
}

const LANGUAGES: { key: "ko" | "en" | "zh"; label: string; hasTranslation: boolean }[] = [
  { key: "ko", label: "한국어 (ko)", hasTranslation: false },
  { key: "en", label: "영어 (en)", hasTranslation: true },
  { key: "zh", label: "중국어 (zh)", hasTranslation: true },
];

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast("클립보드에 복사되었습니다");
  });
}

export default function CategoryModal({ open, onOpenChange, data, isLoading, error, token, onReload }: Props) {
  const [actionError, setActionError] = useState<string | null>(null);
  const { progress, isRunning, activeStep, subscribeProgress, cancel } = useCategoryProgress(() => {
    onReload?.();
  });

  const handleSingleAction = async (stepName: StepName) => {
    if (!data) return;
    setActionError(null);
    subscribeProgress(data.id);
    try {
      await translateEmbedCategory(data.id, token, [stepName]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "실행 실패";
      setActionError(msg);
      cancel();
    }
  };

  const handleRunAll = async () => {
    if (!data) return;
    setActionError(null);
    const steps: StepName[] = [];
    for (const lang of LANGUAGES) {
      if (lang.hasTranslation) {
        const tl = data.languages[lang.key];
        if (!tl.translation_text) steps.push(`translation.${lang.key}` as StepName);
        if (tl.embedding.status !== "completed") steps.push(`embedding.${lang.key}` as StepName);
      } else {
        if (data.languages.ko.embedding.status !== "completed") steps.push("embedding.ko" as StepName);
      }
    }
    if (steps.length === 0) return;
    subscribeProgress(data.id);
    try {
      await translateEmbedCategory(data.id, token, steps);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "실행 실패";
      setActionError(msg);
      cancel();
    }
  };

  const renderRow = (label: string, displayValue: string | null, copyValue: string | null, stepName: StepName | null) => {
    const hasValue = displayValue !== null;
    return (
      <div className="grid grid-cols-[80px_1fr_40px] gap-3 items-center py-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm truncate font-mono">
          {hasValue ? (
            displayValue
          ) : activeStep && stepName && activeStep === stepName ? (
            <Loader2 className="size-3 animate-spin inline" />
          ) : (
            <span className="text-muted-foreground italic">처리전</span>
          )}
        </span>
        <div>
          {activeStep && stepName && activeStep === stepName ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : hasValue && copyValue ? (
            <Button variant="ghost" size="icon" onClick={() => copyToClipboard(copyValue)} title="복사">
              <Copy className="size-3" />
            </Button>
          ) : stepName ? (
            <Button variant="ghost" size="icon" onClick={() => handleSingleAction(stepName)} title={label + " 실행"}>
              <Play className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>
    );
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && isRunning) cancel();
    if (!open) setActionError(null);
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>카테고리 상세</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {data ? `코드: ${data.category_code}` : <span className="inline-block h-4 w-24 animate-pulse rounded-md bg-muted" />}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        )}

        {(error || actionError) && (
          <div className="flex items-center gap-2 text-red-500 py-4">
            <AlertCircle className="size-4" />
            <span className="text-sm">{actionError || error}</span>
          </div>
        )}

        {data && !isLoading && (
          <div className="space-y-2 py-2">
            {LANGUAGES.map((lang, i) => {
              const detail = data.languages[lang.key];

              return (
                <div key={lang.key}>
                  {i > 0 && <Separator className="my-2" />}
                  <div className="mb-2">
                    <span className="text-sm font-medium">{lang.label}</span>
                  </div>
                  <div className="space-y-0.5">
                    {lang.hasTranslation
                      ? renderRow(
                          "번역",
                          detail.translation_text,
                          detail.translation_text,
                          `translation.${lang.key}` as StepName,
                        )
                      : renderRow(
                          "원본",
                          detail.translation_text,
                          detail.translation_text,
                          null,
                        )
                    }
                    {renderRow(
                      "임베딩",
                      detail.embedding.preview
                        ? `[${detail.embedding.preview.slice(0, 5).map(v => v.toFixed(3)).join(", ")}]…`
                        : null,
                      detail.embedding.preview
                        ? JSON.stringify(detail.embedding.preview.map(v => Number(v.toFixed(6))))
                        : null,
                      `embedding.${lang.key}` as StepName,
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleRunAll} disabled={isRunning}>
            전체 실행
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: amdin page에서 onReload prop 전달**

`nextjs/app/admin/page.tsx:257-266`의 `<CategoryModal>`에 `onReload` prop 추가:

```tsx
const { data: detailData, isLoading: detailLoading, error: detailError, reload } =
    useCategoryDetail(modalCategoryId, token);

// ...

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
/>
```

- [ ] **Step 5: 테스트 실행하여 통과 확인**

```bash
docker exec cl_embed_nextjs npm test -- components/admin/__tests__/category-modal.test.tsx
docker exec cl_embed_nextjs npm test -- hooks/__tests__/useCategoryProgress.test.ts
docker exec cl_embed_nextjs npm test -- app/admin/__tests__/page.test.tsx
```

All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add nextjs/components/admin/category-modal.tsx \
        nextjs/components/admin/__tests__/category-modal.test.tsx \
        nextjs/app/admin/page.tsx
git commit -m "fix(admin): 모달 체크박스/뱃지 제거, 복사 toast, 실행 로딩/갱신 개선"
```

---

### Task 4: 최종 검증

- [ ] **Step 1: 전체 테스트 실행**

```bash
docker exec cl_embed_nextjs npm test
```

Expected: 모든 기존 테스트 + 신규 테스트 PASS.

- [ ] **Step 2: TypeScript 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: ESLint 체크**

```bash
docker exec cl_embed_nextjs npm run lint
```

Expected: No errors.
