# Embedding Button Disabled 조건 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카테고리 모달에서 임베딩 실행 버튼의 disabled 조건을 올바르게 수정한다 (한국어 빈값 → 한국어 임베딩 disabled, 다른 언어는 자체 텍스트만 확인)

**Architecture:** `category-modal.tsx` 내 `translationDone` 플래그를 번역용/임베딩용으로 분리. 임베딩 버튼은 `isKoEmpty`와 무관하게 각 언어 텍스트 존재 여부만 확인.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Vitest + React Testing Library

---

### Task 1: `embeddingReady` 플래그 분리 및 Play 버튼 disabled 조건 수정

**Files:**
- Modify: `nextjs/components/admin/category-modal.tsx:241-245`
- Test: `nextjs/components/admin/__tests__/category-modal.test.tsx` (test cases 추가)

- [ ] **Step 1: Play 버튼 disabled 검증 테스트 작성**

`nextjs/components/admin/__tests__/category-modal.test.tsx`에 아래 두 테스트를 `describe("CategoryModal")` 블록 내 마지막에 추가:

```typescript
it("한국어가 빈값이면 한국어 임베딩 버튼이 disabled된다", () => {
  const koEmptyData = {
    ...pendingData,
    category_name_ko: "",
    languages: {
      ko: { translation_text: "", embedding: { status: "pending" as const, preview: null } },
      en: { translation_text: null, embedding: { status: "pending" as const, preview: null } },
      zh: { translation_text: null, embedding: { status: "pending" as const, preview: null } },
    },
  };
  render(<CategoryModal open={true} onOpenChange={vi.fn()} data={koEmptyData} isLoading={false} error={null} token="token" execState={createEmptyExecState()} onSingleAction={defaultHandlers.onSingleAction} onRunAll={defaultHandlers.onRunAll} onCancelPending={defaultHandlers.onCancelPending} />);
  const embeddingBtns = screen.getAllByRole("button", { name: "임베딩 실행" });
  // ko embedding: isKoEmpty=true → disabled
  expect(embeddingBtns[0]).toBeDisabled();
});

it("한국어가 빈값이어도 다른 언어에 번역 텍스트가 있으면 임베딩 버튼이 disabled되지 않는다", () => {
  const koEmptyEnTextData = {
    ...pendingData,
    category_name_ko: "",
    languages: {
      ko: { translation_text: "", embedding: { status: "pending" as const, preview: null } },
      en: { translation_text: "Life/Health", embedding: { status: "pending" as const, preview: null } },
      zh: { translation_text: null, embedding: { status: "pending" as const, preview: null } },
    },
  };
  render(<CategoryModal open={true} onOpenChange={vi.fn()} data={koEmptyEnTextData} isLoading={false} error={null} token="token" execState={createEmptyExecState()} onSingleAction={defaultHandlers.onSingleAction} onRunAll={defaultHandlers.onRunAll} onCancelPending={defaultHandlers.onCancelPending} />);
  const embeddingBtns = screen.getAllByRole("button", { name: "임베딩 실행" });
  // ko embedding: isKoEmpty=true → disabled
  expect(embeddingBtns[0]).toBeDisabled();
  // en embedding: 번역텍스트 있음 → enabled (isKoEmpty와 무관)
  expect(embeddingBtns[1]).not.toBeDisabled();
  // zh embedding: 번역텍스트 없음 → disabled
  expect(embeddingBtns[2]).toBeDisabled();
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

```bash
docker exec cl_embed_nextjs node node_modules/vitest/vitest.mjs run --reporter=verbose components/admin/__tests__/category-modal.test.tsx
```

Expected: 두 신규 테스트 FAIL (한국어 임베딩 버튼이 disabled=false, en 임베딩 버튼이 disabled=true)

- [ ] **Step 3: 임베딩 버튼 disabled 조건 수정**

`nextjs/components/admin/category-modal.tsx`의 241-245번째 줄 근처 `translationDone` 계산 로직을 두 개의 플래그로 분리:

```typescript
const hasTranslationText = detail.translation_text !== null || completedSteps.has(transKey) || stepResults.has(transKey);
const translationDone = lang.hasTranslation
  ? (!isKoEmpty && hasTranslationText)
  : true;
const embeddingReady = lang.hasTranslation
  ? hasTranslationText
  : !isKoEmpty;
```

그리고 임베딩 row의 `renderRow` 호출에서 5번째 인자(`translationDone`)를 `embeddingReady`로 변경:

268번째 줄 근처 (en/zh 임베딩):
```typescript
{renderRow(
  "임베딩",
  detail.embedding.preview
    ? `[${detail.embedding.preview.slice(0, 10).map((v) => v.toFixed(3)).join(", ")}…1024차원]`
    : null,
  detail.embedding.preview
    ? JSON.stringify(detail.embedding.preview)
    : null,
  `embedding.${lang.key}` as StepName,
  embeddingReady,    // ← translationDone → embeddingReady
  isExecuting,
  pendingSteps.includes(`embedding.${lang.key}` as StepName),
)}
```

295번째 줄 근처 (ko 임베딩):
```typescript
{renderRow(
  "임베딩",
  detail.embedding.preview
    ? `[${detail.embedding.preview.slice(0, 10).map((v) => v.toFixed(3)).join(", ")}…1024차원]`
    : null,
  detail.embedding.preview
    ? JSON.stringify(detail.embedding.preview)
    : null,
  `embedding.${lang.key}` as StepName,
  embeddingReady,    // ← true → embeddingReady (!isKoEmpty)
  isExecuting,
  pendingSteps.includes(`embedding.${lang.key}` as StepName),
)}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

```bash
docker exec cl_embed_nextjs node node_modules/vitest/vitest.mjs run --reporter=verbose components/admin/__tests__/category-modal.test.tsx
```

Expected: 기존 테스트 + 신규 2개 모두 PASS

- [ ] **Step 5: Playwright로 실제 브라우저 동작 확인**

```bash
# playwright plugin으로 수동 확인:
# 1. admin 페이지 열기 → 카테고리 모달 열기
# 2. 한국어 input 비우기 → blur
# 3. 한국어 임베딩 "임베딩 실행" 버튼이 disabled인지 확인
# 4. 영어/중국어 임베딩 버튼이 각 텍스트 존재 여부에 따라 올바르게 disabled/enabled인지 확인
```

- [ ] **Step 6: Commit**

```bash
git add nextjs/components/admin/category-modal.tsx nextjs/components/admin/__tests__/category-modal.test.tsx
git commit -m "fix: 임베딩 실행 버튼 disabled 조건 수정

- translationDone → translationDone + embeddingReady 플래그 분리
- 한국어 임베딩: isKoEmpty면 Play 버튼 disabled
- en/zh 임베딩: isKoEmpty와 무관, 각 언어 번역텍스트 존재 여부만 확인
- 전체실행 버튼 isKoEmpty disabled은 유지"
```
