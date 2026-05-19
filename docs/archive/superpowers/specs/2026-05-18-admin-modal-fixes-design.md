# Admin 페이지 수정 모달 이슈 해결 설계

날짜: 2026-05-18 (v3)

## 개요

Admin 페이지 카테고리 상세 모달의 3가지 이슈를 수정한다:
1. TSC 타입 체크 실패 (run-all-checks.sh)
2. 개별 실행 버튼 완료 후 목록 미반영
3. 모달 닫힘 시 실행 상태 초기화 문제

## Issue 1: TSC Fail

### 원인
`tsconfig.json`의 `include`에 `.next/dev/types/**/*.ts`가 포함되어 있고, Turbopack이 생성한 `.next/dev/types/validator.ts`에 문법 오류가 있다.

### 수정
`tsconfig.json`의 `exclude` 배열에 `.next`를 추가한다.

### 변경 파일
- `nextjs/tsconfig.json`: `.next`를 `exclude`에 추가

---

## Issue 2: 개별 실행 버튼 목록 미반영

### 원인
`handleSingleAction` 함수에서 실행 완료 후 `onListRefresh?.()`를 호출하지 않는다.

### 수정
`handleSingleAction`의 성공 분기에 `onListRefresh?.()`를 추가한다.

### 변경 파일
- `nextjs/components/admin/category-modal.tsx`

---

## Issue 3: 모달 닫힘 시 실행 상태 초기화

### 원인
실행 상태(runningSteps, pendingSteps, completedSteps, failedSteps, 등)가 `CategoryModal` 내부에 존재하며, `handleOpenChange`가 모달 닫힘 시 이 모든 상태를 초기화한다.

### 수정
`useCategoryExecution` 훅을 생성하여 실행 상태와 로직을 부모 컴포넌트로 분리한다.

### 아키텍처

변경 전:
```
admin/page.tsx                     CategoryModal
┌──────────────────┐              ┌─────────────────────────┐
│                  │  props       │ 실행 상태 + 실행 로직   │
│  CategoryModal   │────────────>│ handleOpenChange = reset │
│                  │              │ 모달 닫으면 상태 소멸    │
└──────────────────┘              └─────────────────────────┘
```

변경 후:
```
admin/page.tsx                     CategoryModal
┌──────────────────────┐          ┌─────────────────────────┐
│ useCategoryExecution │ props    │ (presentational)        │
│ ─ 실행 상태 관리     │────────>│ ─ props 기반 렌더링     │
│ ─ 실행 로직 포함     │          │ ─ 내부 실행 state 없음  │
│ ─ 상태 생명주기 관리  │          │ ─ handleOpenChange=     │
│                      │          │   visual only           │
└──────────────────────┘          └─────────────────────────┘
```

### useCategoryExecution 훅

```typescript
// hooks/useCategoryExecution.ts

type StepName = "translation.zh" | "translation.en" | "embedding.ko" | "embedding.zh" | "embedding.en";

interface CatExecState {
  runningSteps: Set<StepName>;
  pendingSteps: StepName[];
  completedSteps: Set<StepName>;
  failedSteps: Set<StepName>;
  stepResults: Map<StepName, string>;
  copyableSteps: Set<StepName>;
  embeddingFullData: Map<StepName, string>;
  flashSteps: Set<StepName>;
  abortRef: { current: boolean };
}
```

### CategoryModal props 추가

```typescript
interface Props {
  // 기존 props 유지
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CategoryTranslations | null;
  isLoading: boolean;
  error: string | null;
  token?: string | null;
  onReload?: () => void;
  onListRefresh?: () => void;
  // 추가 props
  execState: CatExecState | null;
  onSingleAction: (stepName: StepName) => Promise<void>;
  onRunAll: () => Promise<void>;
  onCancelPending: () => void;
}
```

### 상태 생명주기

| 이벤트 | 동작 |
|--------|------|
| 카테고리 상세 보기 | 해당 카테고리 상태 획득 (없으면 신규) |
| 모달 닫힘 | 상태 유지 |
| 같은 카테고리 다시 열기 | 기존 상태로 진행 상황 표시 |
| 다른 카테고리 열기 | 새 상태 생성 (이전 상태는 메모리 잔류) |

### CategoryModal 내부 변경 사항
- `handleSingleAction`, `handleRunAll`, `handleCancelPending` 제거
- `handleStepComplete` 제거 (훅 내부 처리)
- 실행 관련 state 선언 제거
- `handleOpenChange`: `onOpenChange(open)`만 호출, 상태 리셋 없음
- 모든 실행 관련 로직을 props 콜백으로 위임

### 변경 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `nextjs/tsconfig.json` | Issue 1: `.next` exclude 추가 |
| `nextjs/hooks/useCategoryExecution.ts` | 신규: 실행 상태 관리 훅 |
| `nextjs/components/admin/category-modal.tsx` | Issue 2+3: onListRefresh 추가, 실행 상태 제거, props 기반 렌더링 |
| `nextjs/app/admin/page.tsx` | `useCategoryExecution` 적용 및 props 전달 |

### 테스트 전략
- `useCategoryExecution` 훅 단위 테스트 신규 작성
- `category-modal.test.tsx` props 인터페이스 변경에 맞게 수정
- Playwright E2E로 전체 실행/개별 실행/모달 닫기 동작 검증
