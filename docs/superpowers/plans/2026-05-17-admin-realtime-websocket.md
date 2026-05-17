# Admin 실시간 WebSocket + 임베딩 전체 벡터 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin 카테고리 모달의 번역/임베딩 실행을 WebSocket 실시간 진행으로 개선하고 임베딩 1024차원 전체를 프론트엔드에 전달한다.

**Architecture:** Echo/Reverb WebSocket 연결을 복구하여 기존 `CategoryProgress`/`CategoryPipelineCompleted` 이벤트를 활용한다. 프론트엔드는 Optimistic UI(클릭 즉시 로딩 표시) + WebSocket 이벤트 기반 실시간 갱신으로 개선한다. 백엔드는 `array_slice(0,5)` 제한을 제거한다.

**Tech Stack:** Laravel 13 (PHP), Next.js 16 (React 19 + TypeScript), Echo/Reverb WebSocket, Pest 4, Vitest

---

### Task 1: Echo/Reverb WebSocket 연결 디버깅

**Files:**
- Modify: `nextjs/lib/echo.ts:5-23`
- Check: `nextjs/.env.local`
- Check: docker nginx config

- [ ] **Step 1: Reverb 서버 연결 진단**

```bash
# Reverb 프로세스 확인
docker exec cl_embed_laravel supervisorctl status reverb
# Expected: reverb RUNNING

# Docker network 내 nginx → Reverb 연결 확인
docker exec docker-nginx-1 wget -qO- --timeout=3 http://cl_embed_laravel:8080/ 2>&1
# Expected: "Not found." (정상 — HTTP GET에 Reverb가 반환하는 기본 응답)
```

- [ ] **Step 2: 프론트엔드 Echo 초기화 로그 추가**

`nextjs/lib/echo.ts`에 진단 로깅을 추가한다:

```typescript
import type Echo from "laravel-echo";

export type ReverbEcho = Echo<"reverb">;

export async function createEcho(): Promise<ReverbEcho> {
  console.log("[Echo] dynamic import 시작...");
  const [{ default: EchoClass }, { default: Pusher }] = await Promise.all([
    import("laravel-echo"),
    import("pusher-js"),
  ]);
  console.log("[Echo] import 완료, EchoClass:", !!EchoClass, "Pusher:", !!Pusher);

  window.Pusher = Pusher;

  const key = process.env.NEXT_PUBLIC_REVERB_APP_KEY;
  const wsHost = process.env.NEXT_PUBLIC_REVERB_HOST;
  console.log("[Echo] 설정 — key:", key, "wsHost:", wsHost);

  const echo = new EchoClass({
    broadcaster: "reverb",
    key,
    wsHost,
    wsPort: 443,
    wssPort: 443,
    forceTLS: true,
    enabledTransports: ["ws", "wss"],
    disableStats: true,
  });
  console.log("[Echo] Echo 인스턴스 생성 완료");
  return echo;
}
```

- [ ] **Step 3: 컨테이너에 코드 동기화 및 브라우저 로그 확인**

```bash
# 컨테이너로 코드 동기화
cat /var/app/www/cl_embed/nextjs/lib/echo.ts | docker exec -i cl_embed_nextjs tee /app/lib/echo.ts > /dev/null
# Turbopack HMR 트리거
docker exec cl_embed_nextjs touch /app/lib/echo.ts
```

Playwright로 admin 페이지를 열고 모달 진입 후 console 로그를 확인한다:
- `[Echo] dynamic import 시작...` → `[Echo] import 완료` → `[Echo] Echo 인스턴스 생성 완료` 순서로 출력되는지 확인
- 실패 지점이 어디인지 식별

- [ ] **Step 4: 연결 실패 시 nginx proxy.conf 수정**

연결이 `Echo 인스턴스 생성 완료` 이후 WebSocket handshake 단계에서 실패하는 경우, nginx `Connection "upgrade"` 헤더 설정이 원인일 수 있다. `/etc/nginx/conf.d/common/proxy.conf`의 문제 있는 라인을 수정한다:

```bash
# 현재 proxy.conf 확인
docker exec docker-nginx-1 cat /etc/nginx/conf.d/common/proxy.conf
```

`proxy_set_header Connection "upgrade"`가 모든 요청에 강제로 upgrade를 설정하는 문제 → map 지시문으로 조건부 설정:

```bash
# nginx 컨테이너에 수정된 proxy.conf 적용
docker cp /var/app/docker/nginx/config/conf.d/common/proxy.conf docker-nginx-1:/etc/nginx/conf.d/common/proxy.conf
docker compose -f /var/app/docker/docker-compose.yml exec nginx nginx -s reload
```

proxy.conf 수정 내용:
```nginx
limit_conn perserver 300;
limit_conn perip 30;
limit_rate 512k;

proxy_cache off;

include conf.d/common/cloudflare.conf;

proxy_read_timeout 300;

proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
```

`nginx.conf`의 http 블록에 map 추가:
```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
```

- [ ] **Step 5: 연결 성공 검증**

```bash
# Playwright로 admin 페이지 접속 후 모달 열기
# window.Echo 존재 여부 확인
```

Playwright evaluate:
```js
await page.evaluate(() => !!window.Echo)
// Expected: true
```

- [ ] **Step 6: Commit**

```bash
git add nextjs/lib/echo.ts
git commit -m "debug(echo): Echo/Reverb 초기화 진단 로깅 추가"
```

---

### Task 2: 백엔드 임베딩 전체 벡터 반환

**Files:**
- Modify: `laravel/app/Http/Resources/CategoryTranslationsResource.php:50-53`
- Test: `laravel/tests/Feature/Resources/CategoryTranslationsResourceTest.php` (신규)

- [ ] **Step 1: Resource 수정**

`laravel/app/Http/Resources/CategoryTranslationsResource.php:50-53`:

```php
// Before
'preview' => $vector !== [] ? array_slice($vector, 0, 5) : null,

// After
'preview' => $vector !== [] ? array_map(fn($v) => (float) $v, $vector) : null,
```

- [ ] **Step 2: 컨테이너 동기화**

```bash
cat /var/app/www/cl_embed/laravel/app/Http/Resources/CategoryTranslationsResource.php | docker exec -i cl_embed_laravel bash -c "cat > /var/www/html/app/Http/Resources/CategoryTranslationsResource.php"
```

- [ ] **Step 3: API 응답 검증**

```bash
# 현재 토큰으로 API 호출하여 preview 배열 길이 확인
TOKEN=$(docker exec cl_embed_laravel php artisan tinker --execute 'echo \App\Models\User::first()->createToken("debug")->plainTextToken;')
curl -s "https://embed.cunlim.dev/api/categories/1/translations" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; preview=d['languages']['ko']['embedding']['preview']; print(f'preview length: {len(preview)}')"
# Expected: preview length: 1024
```

- [ ] **Step 4: Commit**

```bash
git add laravel/app/Http/Resources/CategoryTranslationsResource.php
git commit -m "fix(api): 임베딩 preview 전체 1024차원 반환하도록 수정"
```

---

### Task 3: useCategoryProgress 훅 개선

**Files:**
- Modify: `nextjs/hooks/useCategoryProgress.ts:1-133`
- Modify: `nextjs/hooks/__tests__/useCategoryProgress.test.ts:1-131`

- [ ] **Step 1: 테스트 수정 — echo null 시에도 isRunning=true 검증**

`nextjs/hooks/__tests__/useCategoryProgress.test.ts`에 다음 테스트 추가 (기존 테스트는 유지):

```typescript
it("echo가 null이어도 subscribeProgress 호출 시 isRunning이 true가 된다", () => {
  // useEcho mock을 null로 오버라이드
  const useEchoModule = require("@/hooks/useEcho");
  useEchoModule.useEcho.mockReturnValue(null);

  const { result } = renderHook(() => useCategoryProgress());

  act(() => {
    result.current.subscribeProgress(1);
  });

  expect(result.current.isRunning).toBe(true);
});

it("category.progress completed 이벤트 수신 시 onUpdate 콜백이 progress 데이터와 함께 호출된다", () => {
  const onUpdate = vi.fn();
  const { result } = renderHook(() => useCategoryProgress(onUpdate));

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
      status: "completed",
    });
  });

  expect(onUpdate).toHaveBeenCalledWith({
    categoryId: 1,
    step: 1,
    stepName: "translation.zh",
    status: "completed",
  });
});

it("category.progress failed 이벤트 수신 시 onUpdate 콜백이 progress 데이터와 함께 호출된다", () => {
  const onUpdate = vi.fn();
  const { result } = renderHook(() => useCategoryProgress(onUpdate));

  act(() => {
    result.current.subscribeProgress(1);
  });

  const progressCallback = mockListen.mock.calls.find(
    ([event]) => event === ".category.progress",
  )?.[1];

  act(() => {
    progressCallback({
      categoryId: 1,
      step: 2,
      stepName: "embedding.ko",
      status: "failed",
      error: "Ollama timeout",
    });
  });

  expect(onUpdate).toHaveBeenCalledWith({
    categoryId: 1,
    step: 2,
    stepName: "embedding.ko",
    status: "failed",
    error: "Ollama timeout",
  });
});

it("category.completed 이벤트 수신 시 onUpdate가 인자 없이 호출된다", () => {
  const onUpdate = vi.fn();
  const { result } = renderHook(() => useCategoryProgress(onUpdate));

  act(() => {
    result.current.subscribeProgress(1);
  });

  const completedCallback = mockListen.mock.calls.find(
    ([event]) => event === ".category.completed",
  )?.[1];

  act(() => {
    completedCallback({ categoryId: 1, allSuccess: true, failedStep: 0 });
  });

  expect(onUpdate).toHaveBeenCalledWith(); // 인자 없음 = 전체 완료
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
docker exec cl_embed_nextjs npx vitest run hooks/__tests__/useCategoryProgress.test.ts 2>&1 | tail -20
# Expected: FAIL (신규 테스트 실패)
```

- [ ] **Step 3: useCategoryProgress 구현 수정**

`nextjs/hooks/useCategoryProgress.ts`:

```typescript
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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

export function useCategoryProgress(
  onUpdate?: (progress?: CategoryProgress) => void,
): UseCategoryProgressReturn {
  const echo = useEcho();
  const [progress, setProgress] = useState<CategoryProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeStep, setActiveStep] = useState<StepName | null>(null);
  const channelRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const categoryIdRef = useRef<number | null>(null);
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });

  const subscribeProgress = useCallback(
    (categoryId: number) => {
      setIsRunning(true);
      categoryIdRef.current = categoryId;

      if (!echo) {
        console.warn("Echo 연결이 없습니다. WebSocket 진행 상황을 수신할 수 없습니다.");
        return;
      }

      const channelName = `category.${categoryId}`;
      channelRef.current = channelName;

      const channel = echo.channel(channelName);
      channel.listen(".category.progress", (data: CategoryProgress) => {
        setProgress(data);
        setActiveStep(data.stepName);
        if (data.status === "completed" || data.status === "failed") {
          onUpdateRef.current?.(data);
        }
      });
      channel.listen(".category.completed", () => {
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

핵심 변경:
1. `onUpdate` 타입을 `(progress?: CategoryProgress) => void`로 변경 (선택적 progress 인자)
2. `subscribeProgress`에서 echo null 여부와 관계없이 `setIsRunning(true)` 호출
3. `.category.progress` 핸들러에서 `completed`/`failed` status 시 `onUpdateRef.current?.(data)` 호출
4. `.category.completed` 핸들러에서 `onUpdateRef.current?.()` 호출 (인자 없음)

- [ ] **Step 4: 테스트 통과 확인**

```bash
docker exec cl_embed_nextjs npx vitest run hooks/__tests__/useCategoryProgress.test.ts 2>&1 | tail -20
# Expected: all tests PASS
```

- [ ] **Step 5: Commit**

```bash
git add nextjs/hooks/useCategoryProgress.ts nextjs/hooks/__tests__/useCategoryProgress.test.ts
git commit -m "feat(hook): useCategoryProgress에 optimistic UI + 단계별 onUpdate 콜백 추가"
```

---

### Task 4: category-modal.tsx Optimistic UI + 실시간 상태

**Files:**
- Modify: `nextjs/components/admin/category-modal.tsx:1-195`
- Modify: `nextjs/components/admin/__tests__/category-modal.test.tsx:1-261`

- [ ] **Step 1: 테스트 수정 — 모달 Props 확장 + 새 동작 검증**

`nextjs/components/admin/__tests__/category-modal.test.tsx`를 전체 교체:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CategoryModal from "@/components/admin/category-modal";

vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

const mockWriteText = vi.fn();
Object.assign(navigator, {
  clipboard: { writeText: mockWriteText },
});

const mockSubscribeProgress = vi.fn();
const mockCancel = vi.fn();

const mockProgressDefault = {
  progress: null,
  isRunning: false,
  activeStep: null as string | null,
  startTranslation: vi.fn(),
  subscribeProgress: mockSubscribeProgress,
  cancel: mockCancel,
};

vi.mock("@/hooks/useCategoryProgress", () => ({
  useCategoryProgress: vi.fn(() => mockProgressDefault),
}));

vi.mock("@/lib/api", () => ({
  translateEmbedCategory: vi.fn().mockResolvedValue({}),
}));

import { useCategoryProgress } from "@/hooks/useCategoryProgress";

const pendingData = {
  id: 4,
  category_code: "CAT_004",
  category_name_ko: "생활/건강>세탁용품>다림판",
  embedding_dimensions: 1024,
  languages: {
    ko: {
      translation_text: "생활/건강>세탁용품>다림판",
      embedding: { status: "pending" as const, preview: null },
    },
    en: {
      translation_text: null,
      embedding: { status: "pending" as const, preview: null },
    },
    zh: {
      translation_text: null,
      embedding: { status: "pending" as const, preview: null },
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockProgressDefault.isRunning = false;
  mockProgressDefault.activeStep = null;
  mockWriteText.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("CategoryModal", () => {
  it("미완료 항목에 Play 아이콘 실행 버튼이 표시된다", () => {
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

  it("isRunning일 때 전체 실행 버튼이 disabled 되고 모든 Play 버튼도 disabled 된다", () => {
    mockProgressDefault.isRunning = true;

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

    const runAllButton = screen.getByRole("button", { name: "전체 실행" });
    expect(runAllButton).toBeDisabled();

    const playButtons = screen.getAllByRole("button", { name: "번역 실행" });
    playButtons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it("activeStep이 설정되면 해당 버튼 영역에 Loader2가 표시된다", () => {
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

    const loaderIcons = document.querySelectorAll(".animate-spin");
    expect(loaderIcons.length).toBeGreaterThanOrEqual(1);
  });

  it("완료된 항목에 복사 버튼이 표시된다", () => {
    const completedData = {
      ...pendingData,
      languages: {
        ...pendingData.languages,
        en: {
          translation_text: "Life/Health>Laundry>Ironing Board",
          embedding: { status: "completed" as const, preview: [0.1, 0.2, 0.3] },
        },
      },
    };

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

  it("복사 버튼 클릭 시 clipboard에 쓰고 toast를 호출한다", async () => {
    const completedData = {
      ...pendingData,
      languages: {
        ...pendingData.languages,
        ko: {
          translation_text: "생활/건강>세탁용품>다림판",
          embedding: { status: "completed" as const, preview: Array.from({ length: 1024 }, (_, i) => (i + 1) / 1024) },
        },
      },
    };

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
  });

  it("임베딩 preview가 null 아닐 때 복사 버튼에 전체 벡터를 복사한다", () => {
    const fullVector = Array.from({ length: 1024 }, (_, i) => +(i / 1024).toFixed(6));
    const data = {
      ...pendingData,
      languages: {
        ...pendingData.languages,
        ko: {
          translation_text: "생활/건강>세탁용품>다림판",
          embedding: { status: "completed" as const, preview: fullVector },
        },
      },
    };

    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={data}
        isLoading={false}
        error={null}
        token="token"
      />,
    );

    const copyButtons = screen.getAllByRole("button", { name: "복사" });
    fireEvent.click(copyButtons[0]);

    expect(mockWriteText).toHaveBeenCalledWith(JSON.stringify(fullVector));
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

  it("에러 발생 시 에러 메시지가 표시된다", () => {
    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={pendingData}
        isLoading={false}
        error="번역 API 호출 실패"
        token="token"
      />,
    );

    expect(screen.getByText("번역 API 호출 실패")).toBeInTheDocument();
  });

  it("onListRefresh prop이 전달되면 모달이 정상 렌더링된다", () => {
    const onListRefresh = vi.fn();
    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={pendingData}
        isLoading={false}
        error={null}
        token="token"
        onListRefresh={onListRefresh}
      />,
    );

    expect(screen.getByText("한국어 (ko)")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
docker exec cl_embed_nextjs npx vitest run components/admin/__tests__/category-modal.test.tsx 2>&1 | tail -20
# Expected: FAIL 일부 (신규 테스트 실패)
```

- [ ] **Step 3: category-modal.tsx 구현 수정**

`nextjs/components/admin/category-modal.tsx`:

```typescript
"use client";

import { useState, useCallback } from "react";
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
import { useCategoryProgress, type StepName, type CategoryProgress } from "@/hooks/useCategoryProgress";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CategoryTranslations | null;
  isLoading: boolean;
  error: string | null;
  token?: string | null;
  onReload?: () => void;
  onListRefresh?: () => void;
}

const LANGUAGES: { key: "ko" | "en" | "zh"; label: string; hasTranslation: boolean }[] = [
  { key: "ko", label: "한국어 (ko)", hasTranslation: false },
  { key: "en", label: "영어 (en)", hasTranslation: true },
  { key: "zh", label: "중국어 (zh)", hasTranslation: true },
];

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast("클립보드에 복사되었습니다");
  }).catch(() => {
    toast("복사에 실패했습니다");
  });
}

export default function CategoryModal({
  open, onOpenChange, data, isLoading, error, token, onReload, onListRefresh,
}: Props) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [runningSteps, setRunningSteps] = useState<Set<StepName>>(new Set());
  const [completedSteps, setCompletedSteps] = useState<Set<StepName>>(new Set());
  const [failedSteps, setFailedSteps] = useState<Set<StepName>>(new Set());

  const handleProgressUpdate = useCallback((progress?: CategoryProgress) => {
    if (progress) {
      if (progress.status === "completed") {
        setCompletedSteps((prev) => new Set(prev).add(progress.stepName));
        setRunningSteps((prev) => {
          const next = new Set(prev);
          next.delete(progress.stepName);
          return next;
        });
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
      onReload?.();
      onListRefresh?.();
    } else {
      // 전체 완료
      onReload?.();
      onListRefresh?.();
    }
  }, [onReload, onListRefresh]);

  const { isRunning, activeStep, subscribeProgress, cancel } = useCategoryProgress(handleProgressUpdate);

  const handleSingleAction = async (stepName: StepName) => {
    if (!data) return;
    setActionError(null);
    // Optimistic UI: 즉시 running 상태로 표시
    setRunningSteps((prev) => new Set(prev).add(stepName));
    subscribeProgress(data.id);
    try {
      await translateEmbedCategory(data.id, token, [stepName]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "실행 실패";
      setActionError(msg);
      setRunningSteps((prev) => {
        const next = new Set(prev);
        next.delete(stepName);
        return next;
      });
      setFailedSteps((prev) => new Set(prev).add(stepName));
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
        if (data.languages[lang.key].embedding.status !== "completed") steps.push(`embedding.${lang.key}` as StepName);
      }
    }
    if (steps.length === 0) return;
    // Optimistic UI: 모든 대상 step을 running으로 표시
    setRunningSteps(new Set(steps));
    subscribeProgress(data.id);
    try {
      await translateEmbedCategory(data.id, token, steps);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "실행 실패";
      setActionError(msg);
      setRunningSteps(new Set());
      cancel();
    }
  };

  const renderRow = (
    label: string,
    displayValue: string | null,
    copyValue: string | null,
    stepName: StepName | null,
  ) => {
    const hasValue = displayValue !== null;
    const isRunningThis = runningSteps.has(stepName!) || (activeStep === stepName);
    const isCompleted = hasValue || completedSteps.has(stepName!);
    const isFailed = failedSteps.has(stepName!);

    return (
      <div className="grid grid-cols-[80px_1fr_40px] gap-3 items-center py-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm truncate font-mono">
          {hasValue ? (
            displayValue
          ) : isRunning ? (
            <Loader2 className="size-3 animate-spin inline" />
          ) : isFailed ? (
            <span className="text-destructive italic">실패</span>
          ) : (
            <span className="text-muted-foreground italic">처리전</span>
          )}
        </span>
        <div>
          {isRunningThis ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
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
      </div>
    );
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && isRunning) cancel();
    if (!open) {
      setActionError(null);
      setRunningSteps(new Set());
      setCompletedSteps(new Set());
      setFailedSteps(new Set());
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>카테고리 상세</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {data ? (
              `코드: ${data.category_code}`
            ) : (
              <span className="inline-block h-4 w-24 animate-pulse rounded-md bg-muted" />
            )}
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
                        ? `[${detail.embedding.preview.slice(0, 10).map((v) => v.toFixed(3)).join(", ")}…1024차원]`
                        : null,
                      detail.embedding.preview
                        ? JSON.stringify(detail.embedding.preview)
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

핵심 변경:
1. `runningSteps`, `completedSteps`, `failedSteps` 로컬 state (Set) 추가
2. `handleSingleAction`/`handleRunAll`에서 클릭 즉시 `runningSteps`에 추가 (optimistic UI)
3. `renderRow`에서 `isRunning` 여부에 따라 Play/Loader2/Copy/AlertCircle 아이콘 분기
4. `isRunning` 시 모든 Play 버튼 disabled
5. 임베딩 표시: `preview.slice(0, 10)` + "…1024차원", 복사 시 전체 벡터 JSON
6. `handleOpenChange`에서 모달 닫힐 때 모든 로컬 state 초기화
7. `onListRefresh` prop 추가

- [ ] **Step 4: 테스트 통과 확인**

```bash
docker exec cl_embed_nextjs npx vitest run components/admin/__tests__/category-modal.test.tsx 2>&1 | tail -20
# Expected: all tests PASS
```

- [ ] **Step 5: Commit**

```bash
git add nextjs/components/admin/category-modal.tsx nextjs/components/admin/__tests__/category-modal.test.tsx
git commit -m "feat(admin): 카테고리 모달 Optimistic UI + WebSocket 실시간 진행 표시"
```

---

### Task 5: admin/page.tsx 실시간 리스트 갱신

**Files:**
- Modify: `nextjs/app/admin/page.tsx:32-65` (useCallback, CategoryModal props)
- Modify: `nextjs/app/admin/__tests__/page.test.tsx:1-163`

- [ ] **Step 1: 테스트 수정**

`nextjs/app/admin/__tests__/page.test.tsx`에 CategoryModal로 `onListRefresh` prop 전달 검증 추가:

기존 `mockUseCategoryProgress` 리턴값에 `activeStep` 추가:
```typescript
mockUseCategoryProgress.mockReturnValue({
  progress: null,
  isRunning: false,
  activeStep: null,
  startTranslation: vi.fn(),
  subscribeProgress: vi.fn(),
  cancel: vi.fn(),
});
```

렌더링된 `CategoryModal`에 `onListRefresh` prop이 전달되었는지 검증하는 테스트는 간접적으로 — `loadCategories`가 mock 함수로 존재하므로 `onListRefresh`로 전달되었을 때 올바르게 연결된다.

실제 테스트에서 `loadCategories`가 호출되었는지 검증하려면 `useCategoryProgress`의 `onUpdate` 콜백을 캡처해야 한다. 이는 Task 3에서 이미 검증했으므로, admin page 테스트는 기존 테스트 통과 여부 확인에 집중한다.

- [ ] **Step 2: admin/page.tsx 수정**

`nextjs/app/admin/page.tsx`의 `CategoryModal` 사용 부분 변경:

```typescript
const token = mounted ? getToken() : null;
const {
  categories,
  isLoading: catLoading,
  error: catError,
  loadCategories,
  addCategory,
} = useCategories(token);

// ... (기존 코드 유지)

{/* 카테고리 상세 모달 */}
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
  onListRefresh={loadCategories}
/>
```

`onListRefresh={loadCategories}` 한 줄만 추가된다.

- [ ] **Step 3: 테스트 통과 확인**

```bash
docker exec cl_embed_nextjs npx vitest run app/admin/__tests__/page.test.tsx 2>&1 | tail -20
# Expected: all tests PASS
```

- [ ] **Step 4: Commit**

```bash
git add nextjs/app/admin/page.tsx nextjs/app/admin/__tests__/page.test.tsx
git commit -m "feat(admin): 메인 리스트 실시간 갱신을 위한 onListRefresh prop 전달"
```

---

### Task 6: 통합 검증 및 최종 커밋

- [ ] **Step 1: 전체 테스트 실행**

```bash
# 프론트엔드 테스트
docker exec cl_embed_nextjs npx vitest run 2>&1 | tail -30
# Expected: all tests PASS

# 백엔드 테스트
docker exec cl_embed_laravel php artisan test --compact 2>&1 | tail -20
# Expected: all tests PASS
```

- [ ] **Step 2: Playwright E2E 검증**

```bash
# Playwright로 실제 admin 페이지 테스트
# 1. admin 로그인 → 모달 열기 → 개별 실행 클릭 → Loader2 표시 확인
# 2. WebSocket 연결 시 실시간 진행 확인
# 3. 실행 완료 후 목록 갱신 확인
```

- [ ] **Step 3: Commit 최종 정리**

```bash
git status
git log --oneline -6
```
