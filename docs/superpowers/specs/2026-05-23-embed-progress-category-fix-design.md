# Embed Progress Bar 카테고리 기준 표시 및 통계 유지

## 날짜
2026-05-23

## 상태
승인됨

## 문제

1. **Progress bar가 step 단위로 표시됨**: `task-execution.tsx`에서 `pct`를 `completedSteps / totalSteps`로 계산하는데, `totalSteps`/`completedSteps`가 카테고리마다 리셋되어 전체 진행률이 아닌 현재 카테고리 내 step 진행률만 보여줌.
2. **이미 처리된 카테고리 선택 시 통계 미표시**: `queue.length === 0`일 때 `queueEmpty: true`로 설정하고 "처리할 단계가 없습니다"만 표시. Progress bar와 통계(전체/완료/실패 카운트)가 사라짐.

## 설계

### 수정 1: `pct` 계산을 카테고리 기준으로 변경

`task-execution.tsx:292-295` — `(completedSteps / totalSteps)` → `((completedCategories + failedCategories) / totalCategories)`

완료+실패 카테고리 합계를 전체 카테고리 수로 나누어 진행률 계산. `totalCategories`는 초기 설정 후 변경되지 않으므로 progress bar가 카테고리 간 균등하게 진행됨.

### 수정 2: `queueEmpty`일 때도 통계 유지

`task-execution.tsx:322-350` — `queueEmpty` 분기를 제거하고 항상 통계(Progress bar, 전체/완료/실패 카운트)를 표시. `queueEmpty`일 때는 "모든 카테고리가 이미 처리되었습니다" 메시지를 추가로 표시하고 현재 카테고리/스텝 정보는 숨김.

## 범위

- **파일 1개**: `nextjs/components/admin/task-execution.tsx`
- **신규 테스트 불필요**: UI 표시 로직 변경만 있음. 기존 테스트로 회귀 검증.
