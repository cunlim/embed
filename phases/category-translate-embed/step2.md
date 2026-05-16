# Step 2: 프론트엔드 API 클라이언트 + useCategoryProgress 훅

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/nextjs/CLAUDE.md` — 프론트엔드 명령어, 컨벤션
- `/nextjs/AGENTS.md` — Next.js 16 브레이킹 체인지 (필독)
- `/docs/UI_GUIDE.md` — 6.4.1절 "카테고리별 개별 번역 → 임베딩 실행" 상세 명세
- `/docs/ARCHITECTURE.md` — "개별 카테고리 처리 (Per-Category)" 데이터 흐름
- `/nextjs/lib/api.ts` — 기존 API 클라이언트 함수, Category 인터페이스
- `/nextjs/hooks/useBatchProgress.ts` — 기존 batch progress 훅 패턴 참고
- `/nextjs/hooks/useEcho.ts` — Echo 인스턴스 훅 패턴 참고

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

### 1. API 클라이언트 함수 추가 (`nextjs/lib/api.ts`)

`translateEmbedCategory()` 함수를 추가한다.

```typescript
// POST /api/categories/{id}/translate-embed
// 응답: { message: string, category_id: number }
export async function translateEmbedCategory(
  categoryId: number,
  token?: string | null,
): Promise<{ message: string; category_id: number }>
```

기존 `createCategory()`, `batchTranslate()` 함수의 패턴을 참고하라:
- `apiClient.post(url, data, config?)` 헬퍼 사용
- `token`이 있으면 `Authorization: Bearer ${token}` 헤더 추가
- 응답에서 `res.data` 추출

### 2. `CategoryProgress` 타입 정의

```typescript
export interface CategoryProgress {
  categoryId: number;
  step: number;       // 1~5
  stepName: string;   // "translation.zh" | "translation.en" | "embedding.ko" | "embedding.zh" | "embedding.en"
  status: "pending" | "running" | "completed" | "failed";
  error?: string;
}
```

이 타입은 `hooks/useCategoryProgress.ts`에서 사용하므로, 훅 파일 내에 정의하거나 `lib/types.ts`에 정의한다. 기존에 `BatchProgress` 타입이 정의된 방식을 따르라 (`hooks/useBatchProgress.ts` 내부에 정의되어 있다).

### 3. `useCategoryProgress` 훅 생성 (`nextjs/hooks/useCategoryProgress.ts`)

```typescript
export interface UseCategoryProgressReturn {
  progress: CategoryProgress | null;
  isRunning: boolean;
  startTranslation: (categoryId: number, token?: string | null) => Promise<void>;
  reset: () => void;
}
```

**동작:**

1. `useEcho()`로 Echo 인스턴스를 얻는다.
2. `startTranslation(categoryId, token)` 호출 시:
   - `isRunning`을 `true`로 설정
   - `translateEmbedCategory(categoryId, token)` API 호출
   - `echo.channel("category.{categoryId}")` 구독 시작
   - `.listen(".category.progress", callback)` — `setProgress(data)` 호출
   - `.listen(".category.completed", callback)` — `isRunning`을 `false`로 설정, 최종 progress 저장
3. `reset()` 호출 시:
   - channel leave
   - progress, isRunning 초기화
4. 언마운트 시 cleanup: channel leave

**핵심 규칙:**
- **Echo 구독은 `startTranslation` 호출 이후에 시작하라.** API 응답 전에 구독하면 이벤트를 놓칠 수 있다면 API 호출 전에 구독하라. 언제 구독해야 하는지는 실제 이벤트 발행 시점(Job dispatch 이후)과 구독 시점을 고려하여 판단하라.
- `useEcho()`의 `echo`는 `null`일 수 있다. `echo`가 `null`이면 `startTranslation`에서 early return하고 console.warn을 출력하라.
- `useSearchParams` 관련 제약 — 이 훅은 `useSearchParams`를 사용하지 않으므로 `<Suspense>` 불필요.

### 4. 테스트 작성 (`nextjs/hooks/__tests__/useCategoryProgress.test.ts`)

- `renderHook` + `act` 사용
- `translateEmbedCategory` API 호출 mock (`vi.mock("@/lib/api")`)
- Echo mock — `channel().listen()` mock
- `startTranslation` 호출 시 API 호출 + WebSocket 구독 검증
- progress 이벤트 수신 시 상태 업데이트 검증
- completed 이벤트 수신 시 `isRunning` false 전환 검증

기존 `hooks/__tests__/useBatchProgress.test.ts` 패턴을 참고하라.

## Acceptance Criteria

```bash
# 프론트엔드 테스트 (Vitest)
docker exec cl_embed_nextjs npm test

# TypeScript 타입 체크
docker exec cl_embed_nextjs npx tsc --noEmit
```

## 검증 절차

1. 위 AC 커맨드를 실행한다. **테스트 0 failure**, **tsc 오류 0**이어야 한다.
2. 아키텍처 체크리스트를 확인한다:
   - API 엔드포인트 URL이 ARCHITECTURE.md의 `POST /api/categories/{id}/translate-embed`와 일치하는가?
   - WebSocket 채널이 `category.{categoryId}` 인가?
   - 이벤트명이 `.category.progress`, `.category.completed` 인가? (Laravel Echo는 `broadcastAs()` 이름에 dot prefix)
   - UI_GUIDE.md의 5단계 명세와 `CategoryProgress.stepName` 값이 일치하는가?
3. 결과에 따라 `phases/category-translate-embed/index.json`의 step 2를 업데이트한다.

## 금지사항

- `window.Pusher` 타입을 `as never as`로 우회하지 마라. `global.d.ts`나 `declare global`로 정식 선언하라.
- `useSearchParams`를 사용하지 마라 (이 훅은 필요하지 않다).
- `useEffect` 내 동기적 `setState` 호출 금지. `react-hooks/set-state-in-effect` 규칙 위반이다.
- API 응답 형식을 가정하지 말고, Step 0~1에서 정의된 실제 Laravel 응답과 일치시켜라.
- 기존 테스트를 깨뜨리지 마라
