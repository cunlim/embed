# Embed 페이지 일괄 처리 이슈 수정

**날짜:** 2026-05-23
**상태:** 승인됨

## 개요

`task-execution.tsx`의 4가지 이슈를 수정한다:
1. 중지/완료 시 체크박스 해제 + 재실행 기능 부재
2. 카테고리별 즉시 갱신 부재
3. 통계 기준 오류 + step 번호 미표시
4. 처리 완료된 카테고리 선택 시 진행상태 깜빡임

---

## 변경 대상

| 파일 | 변경 내용 |
|------|----------|
| `nextjs/components/admin/task-execution.tsx` | 핵심 수정 — 상태 인터페이스, 중지/재실행, 통계, 빈 큐 처리 |
| `nextjs/app/embed/page.tsx` | `onComplete` 시그니처 변경, `onCategoryComplete` 추가 |
| `nextjs/hooks/__tests__/useCategoryExecution.test.ts` | 필요 시 갱신 |
| `nextjs/app/embed/__tests__/page.test.tsx` | 필요 시 갱신 |

---

## 상세 설계

### 1. `BatchProgress` 인터페이스 변경

```typescript
interface BatchProgress {
  totalCategories: number;
  completedCategories: number;
  failedCategories: number;
  totalSteps: number;          // 현재 카테고리의 step 총 개수
  completedSteps: number;      // 현재 카테고리 내 완료 step 수
  failedSteps: number;
  currentCategory: string;
  currentStep: string;
  currentStepIndex: number;    // 1-based
  currentCategoryIndex: number; // 1-based
  queueEmpty: boolean;
}
```

### 2. `onComplete` 시그니처 변경

```typescript
onComplete: (wasStopped: boolean) => void;
onCategoryComplete?: () => void;
```

- `wasStopped === true`: 중지 상태 — 페이지는 체크박스 유지
- `wasStopped === false`: 정상 종료 — 페이지는 체크박스 해제
- `onCategoryComplete`: 카테고리 하나의 모든 step 완료 시 호출 → 리스트 갱신

### 3. 중지/재실행 로직

- `handleStop`: `abortRef.current = true`, `wasStopped = true`, progress 유지
- `wasStopped === true` 일 때 하단에 **재실행 버튼**(일반 variant) 표시
- 재실행 클릭: `wasStopped = false`, 기존 targetIds로 `executeQueue` 재호출
- targetIds는 useRef로 보존하여 재실행 시 재사용

### 4. 실행 중 버튼 배치

```
실행 전:     [선택 처리] [전체 처리]
실행 중:     [선택 처리(disabled)] [전체 처리(disabled)]
             ... progress 영역 ...
             [실행중지] (variant="destructive")
중지 후:     [선택 처리] [전체 처리]
             ... progress 영역 (마지막 상태 유지) ...
             [재실행] (variant="outline")
완료 후:     [선택 처리] [전체 처리]
             ... progress 영역 (최종 상태 유지) ...
```

### 5. 카테고리별 즉시 갱신

- 카테고리 하나의 모든 step이 완료되면 `onCategoryComplete()` 호출
- `completedCategories` 증가, `completedSteps`/`failedSteps` 리셋
- 다음 카테고리 진입 시 `totalSteps`/`currentStepIndex` 재설정

### 6. 통계 표시 형식

```
전체 2개 / 완료 1개 / 실패 0개
현재 카테고리: "테스트1>테스트11"
현재: "[3/5] embedding.ko"
```

- 모든 개수는 카테고리 기준
- 현재 step에 `[현재인덱스/전체step수]` 표시

### 7. 빈 큐 처리 (이미 처리 완료된 카테고리)

- `queue.length === 0` → progress를 null로 초기화하지 않고 `queueEmpty: true` 상태 유지
- UI: "처리할 단계가 없습니다" 메시지 표시, progress 영역 유지
- 완료 후에도 최종 상태를 유지 (기존 정상 완료 동작과 통일)

---

## 검증 체크리스트

- [ ] `docker exec cl_embed_nextjs npx tsc --noEmit` 통과
- [ ] `docker exec cl_embed_nextjs npm test` 통과
- [ ] `docker exec cl_embed_laravel php artisan test --compact` 통과
- [ ] Playwright: 중지 후 체크박스 유지 확인
- [ ] Playwright: 재실행 버튼 표시 및 동작 확인
- [ ] Playwright: 카테고리별 즉시 갱신 확인
- [ ] Playwright: 통계 표시 형식 확인
- [ ] Playwright: 처리 완료된 카테고리 선택 시 진행상태 유지 확인
- [ ] `.claude/hooks/run-all-checks.sh` 통과
