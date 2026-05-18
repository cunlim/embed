# Admin 모달 수정 설계 — 직렬 실행 + 실행중지 + 목록 동기화

2026-05-18

## 개요

Admin 페이지의 카테고리 수정 모달에서 2가지 이슈를 수정한다.

- **이슈 1**: 전체실행 시 2개 배치(번역 병렬 → 임베딩 병렬) 대신 5개 스텝을 위에서부터 직렬로 실행. 실행중지 버튼 도입.
- **이슈 2**: 각 스텝 완료 시 카테고리 목록 상태를 실시간 반영.

변경 대상 파일: `nextjs/components/admin/category-modal.tsx`

---

## 이슈 1: 직렬 실행 + 실행중지

### 현재 동작

`handleRunAll()`이 `Promise.allSettled`로 2개 배치를 사용:
1. 번역 스텝(`translation.en`, `translation.zh`) 병렬 실행
2. 임베딩 스텝(`embedding.ko`, `embedding.en`, `embedding.zh`) 병렬 실행

각 배치가 완료된 후에야 결과가 일괄 표시된다. "실행중지" 버튼이 없어 중간에 중단할 수 없다.

### 변경 동작

5개 스텝을 위에서부터 순서대로 직렬 실행:

1. `embedding.ko` (한국어 임베딩)
2. `translation.en` (영어 번역)
3. `embedding.en` (영어 임베딩)
4. `translation.zh` (중국어 번역)
5. `embedding.zh` (중국어 임베딩)

### 버튼 상태 전이

| 순서 | 버튼 | 아이콘 | 상태 |
|------|------|--------|------|
| 현재 실행 중인 step | Loader2 | `animate-spin` | disabled |
| 대기 중인 step (pending) | Clock | `animate-pulse` | disabled |
| 실행중지로 취소된 step | Play | 없음 | disabled |
| 완료된 step | Copy / Check | 없음 | active |
| 아직 실행되지 않은 step | Play | 없음 | enabled |

### 실행중지 버튼

- 실행 대기(pending) 항목이 존재할 때만 모달 하단에 표시
- "전체 실행" 버튼과 "실행중지" 버튼은 둘 중 하나만 표시
- 실행중지 클릭 시:
  - 현재 실행 중인 step은 그대로 완료까지 진행
  - 대기 중인(pending) step들은 취소 → Play(disabled) 버튼으로 복원
  - 실행중지 버튼 제거 → "전체 실행" disabled 버튼으로 전환
- 마지막 step이 실행 중 상태로 진입하면(pending=0) 실행중지 버튼 자동 제거

### 상태 전이 다이어그램

```
idle → [전체 실행]
  → embedding.ko: spin, 나머지 4개: Clock(pulse), 하단: [실행중지]
  → embedding.ko 완료 → Copy, translation.en: spin, 3개: Clock(pulse)
  → 사용자 [실행중지] 클릭
    → embedding.ko: Copy, translation.en: spin 계속, 3개: Play(disabled), 하단: [전체 실행](disabled)
    → translation.en 완료 → Copy, 나머지 3개: Play(enabled), 하단: [전체 실행](enabled)
  → 실행중지 없이 계속
    → 마지막 step embedding.zh: spin, pending=0 → 실행중지 제거, [전체 실행](disabled)
    → embedding.zh 완료 → 모두 Copy, [전체 실행](disabled)
```

### 상태 관리

기존 state를 활용하되 `isRunning` 플래그는 제거하고 `runningSteps`로만 상태를 관리:

```ts
// 기존 state (유지)
const [runningSteps, setRunningSteps] = useState<Set<StepName>>(new Set());
const [pendingSteps, setPendingSteps] = useState<StepName[]>([]);
const [completedSteps, setCompletedSteps] = useState<Set<StepName>>(new Set());
const [failedSteps, setFailedSteps] = useState<Set<StepName>>(new Set());

// 실행중 플래그 (runningSteps.size > 0 || pendingSteps.length > 0)
const isExecuting = runningSteps.size > 0 || pendingSteps.length > 0;
```

### handleRunAll 변경

```ts
const handleRunAll = async () => {
  // 1. 미완료 step을 위→아래 순서로 수집
  const steps: StepName[] = [];
  for (const lang of LANGUAGES) { /* ...기존 로직... */ }
  if (steps.length === 0) return;

  // 2. 첫 step만 running, 나머지는 pending
  setRunningSteps(new Set([steps[0]]));
  setPendingSteps(steps.slice(1));

  // 3. 직렬 실행 루프
  for (const step of steps) {
    try {
      const res = await fetch(`.../run-step`, { /*...*/ });
      // 성공 처리
      setCompletedSteps(prev => new Set(prev).add(step));
      setStepResults(prev => new Map(prev).set(step, res.result));
      
      // 다음 step이 있으면 running으로 전환
      const currentIdx = steps.indexOf(step);
      if (currentIdx < steps.length - 1) {
        const nextStep = steps[currentIdx + 1];
        setRunningSteps(new Set([nextStep]));
        setPendingSteps(steps.slice(currentIdx + 2));
      } else {
        // 마지막 step 완료
        setRunningSteps(new Set());
        setPendingSteps([]);
      }
      
      // 결과 표시 및 목록 갱신
      enableStepCopy(step);
      handleStepComplete(step, data.id);
      onListRefresh?.();
    } catch (err) {
      // 실패 처리
      setFailedSteps(prev => new Set(prev).add(step));
      setRunningSteps(new Set());
      setPendingSteps([]);
      return;
    }
  }
};
```

### 실행중지 (cancelPending)

```ts
const handleCancelPending = () => {
  setPendingSteps([]);
  // runningSteps는 유지 (현재 실행 중인 step은 완료까지 진행)
};
```

`runningSteps.size > 0 && pendingSteps.length === 0`이 되면 실행중지 버튼이 사라지고 전체 실행(disabled) 버튼이 표시된다. 현재 실행 중인 step이 완료되면 `runningSteps`가 비워지고 전체 실행 버튼이 활성화된다.

---

## 이슈 2: 카테고리 목록 실시간 동기화

### 현재 동작

`onListRefresh?.()`가 `handleRunAll()`의 마지막에 한 번만 호출된다. 모든 스텝이 완료된 후에야 목록이 갱신된다.

### 변경 동작

`onListRefresh?.()`를 각 step 완료 시점마다 호출한다. 단, 직렬 실행 루프 내에서 각 step 완료 후 즉시 호출하므로 첫 step 완료 시점에 목록이 갱신되고 사용자는 상태 변화를 볼 수 있다.

### 영향

- 매 step 완료 시 GET `/api/categories?per_page=20` 호출 발생 (최대 5회)
- 현재 페이지네이션 위치를 유지하므로 사용자 경험에 영향 없음
- 네트워크 오버헤드는 미미함 (캐시된 응답, 단일 카테고리 상태만 변경)

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `nextjs/components/admin/category-modal.tsx` | handleRunAll 직렬 실행 루프, 실행중지 버튼, pending 상태 아이콘, onListRefresh 각 step 완료 시 호출 |

백엔드 변경 없음. `POST /api/categories/{id}/run-step` API를 그대로 사용하며, 프론트엔드에서 호출 순서만 직렬로 변경한다.

## 테스트

- **단위 테스트**: `category-modal.test.tsx` — 전체실행 시 첫 step만 running, 나머지는 pending 검증 / 실행중지 시 pending 초기화 검증
- **E2E 테스트**: `admin-run-step.spec.ts` — 전체실행 클릭 후 순차적 결과 표시 확인
