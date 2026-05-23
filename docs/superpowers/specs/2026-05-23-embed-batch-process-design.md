# Embed 페이지 일괄 처리 기능

**날짜:** 2026-05-23
**상태:** 승인됨

## 개요

Embed 페이지의 카테고리 목록에 체크박스를 추가하고, 기존 언어별 전체번역(BatchTranslate)을 제거한 후 선택 처리/전체 처리 기능으로 대체한다.

---

## UI 변경

### 1. 카테고리 목록 테이블 — 체크박스 컬럼

- 테이블 헤더: 첫 번째 컬럼에 **전체선택 Checkbox** 추가 (현재 페이지의 모든 선택 가능 행 토글)
- 각 행: 첫 번째 컬럼에 **개별 Checkbox** 추가
- `canModify(user, category)`가 `false`인 행은 `disabled` 상태로 표시 (체크 불가)
- 모바일 Card 기반 리스트에도 동일한 체크박스 적용

### 2. 좌측 사이드바 — "일괄 번역" Card → "작업 실행" Card

기존 `<BatchTranslate>` Card를 제거하고 `<TaskExecution>` Card로 교체:

```
┌─ 작업 실행 ─────────────────────┐
│                                 │
│  [선택 처리]  [전체 처리]  [중지] │
│                                 │
│  ████████░░░░░░░░ 45%           │
│  전체 120개 / 실행할 60개        │
│  완료 27개 / 실패 2개           │
│  현재: "카테고리명 — translation.ko" │
│                                 │
└─────────────────────────────────┘
```

#### 버튼 동작

| 버튼 | 동작 |
|------|------|
| **선택 처리** | 현재 페이지에서 체크된 항목 중 `canModify=true`인 것만, 각 카테고리의 누락된 step을 순차 실행 |
| **전체 처리** | 현재 필터 기준 모든 페이지의 `canModify=true`인 모든 카테고리의 누락된 step을 순차 실행 (체크박스 상태 무시) |
| **중지** | 현재 실행 중인 step 완료 후 중단. 이미 완료된 step은 유지 |

#### Step 실행 순서 (개별 모달의 "전체실행"과 동일)

각 카테고리당 누락된 step만 실행:
1. `translation.en` (누락 시)
2. `embedding.en` (누락 시)
3. `translation.zh` (누락 시)
4. `embedding.zh` (누락 시)
5. `embedding.ko` (누락 시)

- 한국어(`ko`)는 원본 언어이므로 `translation.ko` step 없음
- 실행 전 `fetchCategoryTranslations`로 각 카테고리의 현재 번역/임베딩 상태 조회 → 누락된 step만 큐에 추가

### 3. 진행률 표시

Card 내부에 프로그레스 바로 실시간 표시:
- `전체 N개`: 전체 대상 카테고리 수
- `실행할 M개`: 누락 step의 총 개수 (초기값 = sum of missing steps across all categories)
- `완료 O개`: 성공적으로 완료된 step 수
- `실패 P개`: 실패한 step 수
- `현재: "카테고리명 — step명"`: 현재 실행 중인 항목

---

## 컴포넌트 아키텍처

### 새 컴포넌트: `TaskExecution`

`nextjs/components/admin/task-execution.tsx` — `"use client"`

```typescript
interface TaskExecutionProps {
  token: string | null;
  selectedIds: Set<number>;          // 현재 페이지에서 체크된 카테고리 ID
  categories: (Category | Recommendation)[];  // 현재 페이지의 카테고리 목록
  filter: string | undefined;        // 현재 필터 (전체/내 카테고리)
  canModify: (cat: Category | Recommendation) => boolean;
  onComplete: () => void;            // 완료 후 목록 갱신 콜백
}
```

상태:
- `running: boolean`
- `abortRef: React.MutableRefObject<boolean>` — 중지 신호
- `progress`: `{ totalCategories, totalSteps, completedSteps, failedSteps, currentCategory, currentStep } | null`

### embed/page.tsx 변경

- `selectedIds` state 추가 (`Set<number>`, 현재 페이지가 바뀌면 초기화)
- `BatchTranslate` import → `TaskExecution` import
- `<BatchTranslate>` → `<TaskExecution>` 교체
- 테이블 컬럼에 Checkbox 추가 (데스크톱 + 모바일)
- `StepName` 타입에 `"translation.ko"` 추가 (현재 5개만 정의되어 있음 — `translation.en`, `translation.zh`, `embedding.ko`, `embedding.zh`, `embedding.en`)

### lib/api.ts 변경

- `getAllCategories()` 제거 (batch-translate에서만 사용)
- `translateEmbedCategory()` 제거 (미사용)
- `cancelTranslateEmbed()` 제거 (미사용)
- `TranslateEmbedResponse` 인터페이스 제거

---

## 데이터 흐름

### 선택 처리

```
1. selectedIds에서 canModify=true인 ID만 필터링
2. 각 ID별로 fetchCategoryTranslations() 호출 → 누락 step 계산
3. 모든 누락 step을 큐에 추가 (totalSteps)
4. abortRef.current 체크하면서 순차 실행 (runStep)
5. step 완료/실패 시 progress 업데이트
6. 모든 step 완료 또는 중지 시 onComplete() 호출
```

### 전체 처리

```
1. GET /api/categories?per_page=10000&filter={currentFilter}
2. canModify=true인 카테고리만 대상
3. 각 ID별로 fetchCategoryTranslations() 호출 → 누락 step 계산
4. 이후 선택 처리와 동일
```

중지 후 재실행 시 누락된 step만 다시 계산되므로 "실행할 개수"는 이전보다 줄어든다.

---

## 제거 대상

| 항목 | 파일 |
|------|------|
| `BatchTranslate` 컴포넌트 | `nextjs/components/admin/batch-translate.tsx` (파일 삭제) |
| `getAllCategories()` | `nextjs/lib/api.ts` |
| `translateEmbedCategory()` | `nextjs/lib/api.ts` |
| `cancelTranslateEmbed()` | `nextjs/lib/api.ts` |
| `TranslateEmbedResponse` | `nextjs/lib/api.ts` |
| `BatchTranslate` import | `nextjs/app/embed/page.tsx` |

Laravel 백엔드에는 제거할 `translate-embed` 관련 코드가 현재 존재하지 않는다 (worktree에서만 존재, 이미 main/develop에 없음).

---

`StepName` 타입은 변경하지 않는다. 한국어(`ko`)는 원본 언어이므로 `translation.ko` step이 존재하지 않으며, 기존 5개 step 정의로 충분하다.

---

## 검증 체크리스트

- [ ] `docker exec cl_embed_nextjs npx tsc --noEmit` 통과
- [ ] `docker exec cl_embed_nextjs npm test` 통과
- [ ] `docker exec cl_embed_laravel php artisan test --compact` 통과
- [ ] Playwright: 체크박스 UI 확인 (전체선택, 개별선택, disabled 상태)
- [ ] Playwright: 선택 처리 동작 확인
- [ ] Playwright: 전체 처리 동작 확인
- [ ] Playwright: 중지 버튼 동작 확인
- [ ] `.claude/hooks/run-all-checks.sh` 통과
