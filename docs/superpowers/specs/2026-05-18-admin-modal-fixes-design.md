# Admin 모달 버튼 상태 버그 수정 설계

2026-05-18 (v2)

## 개요

Admin 페이지 카테고리 상세 모달의 버튼 상태 관련 4가지 버그를 수정한다.

## 변경 대상

- `nextjs/components/admin/category-modal.tsx` — 모든 수정 사항

---

## Fix 1: 전체실행 버튼 로딩 아이콘 제거

### 현재 동작

`isExecuting=true` + `hasPending=false`일 때 전체실행 버튼에 `Loader2` 회전 아이콘이 표시된다.

### 수정

전체실행 버튼의 아이콘 조건을 단순화:
- `allCompleted` → `Check` 아이콘 + `disabled`
- 실행 중 또는 기본 → `Play` 아이콘만 (Loader2 제거)
- 전체실행 버튼은 `disabled={isExecuting || allCompleted}` 유지

### 버튼 상태 흐름

| 상태 | 아이콘 | disabled |
|------|--------|----------|
| 전체실행 (기본) | Play | false |
| 전체실행 (실행 중) | Play | true |
| 전체실행 (전체완료) | Check | true |
| 실행중지 | Square | false |

---

## Fix 2: 번역 완료 후 임베딩 버튼 disabled 해제

### 현재 동작

`handleSingleAction`으로 번역 실행 성공 시 `completedSteps`와 `stepResults`에는 반영되지만,
`data` prop이 갱신되지 않아 `detail.translation_text`가 여전히 `null`이다.
임베딩 버튼의 `disabled` 조건이 `detail.translation_text !== null`에 의존하므로 disabled가 해제되지 않는다.

### 수정

임베딩 버튼의 disabled 조건에 `completedSteps`와 `stepResults`를 추가로 확인:

```
translationDone = detail.translation_text !== null 
                || completedSteps.has("translation.{lang}") 
                || stepResults.has("translation.{lang}")
```

이렇게 하면 서버 데이터가 갱신되지 않아도 로컬 실행 결과를 기반으로 disabled가 해제된다.

---

## Fix 3: 실행중지 후 runningSteps 정리

### 현재 동작

`handleCancelPending()` → `abortRef.current = true`
현재 실행 중인 step이 완료된 후 abort 체크에서 `break`되지만 `runningSteps`가 클리어되지 않는다.
로딩 스피너가 영원히 멈추지 않고 "전체 실행" 버튼도 disabled+로딩 상태로 고정된다.

### 수정

`handleRunAll`의 모든 abort 체크 지점에서 `setRunningSteps(new Set())`, `setPendingSteps([])`를 먼저 호출:

**지점 A** (루프 시작 - 다음 step 직전): `if (abortRef.current)` → `setRunningSteps(new Set()); break;`
**지점 B** (step 완료 후 다음 step 전환 전): `if (abortRef.current)` → `setRunningSteps(new Set()); break;`
**지점 C** (catch 블록): `if (abortRef.current)` → `setRunningSteps(new Set()); break;`

---

## Fix 4: 임베딩 step도 copyableSteps에 추가

### 현재 동작

`handleRunAll`과 `handleSingleAction` 모두 임베딩 step 완료 시 `enableStepCopy()`를 호출하지 않는다.
`copyableSteps`에 임베딩 step이 추가되지 않아 Check 아이콘에서 Copy 버튼으로 전환되지 않는다.

### 수정

임베딩 step 완료 시 `handleStepComplete()` 호출 후 `enableStepCopy(stepName)`를 추가:

```ts
if (stepName.startsWith("embedding")) {
  handleStepComplete(stepName, data.id);
}
enableStepCopy(stepName);  // embedding도 포함
```

---

## 테스트

- 기존 `category-modal.test.tsx`에 다음 케이스 추가:
  - Fix 2: 번역 완료 후 임베딩 버튼 disabled 해제 검증 (completedSteps 모킹)
  - Fix 3: abort 후 runningSteps 정리 검증
  - Fix 4: 임베딩 완료 후 copyableSteps 추가 검증 (setTimeout 우회)

## 영향 범위

`nextjs/components/admin/category-modal.tsx` 1개 파일만 변경. 테스트 파일도 동일 디렉토리.
