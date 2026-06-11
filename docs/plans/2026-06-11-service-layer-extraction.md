# Service Layer Extraction Plan

## Context

모바일 앱에서 Laravel 백엔드를 재사용하기 위해, CategoryController(1034줄)와 FolderController(350줄)에 인라인된 비즈니스 로직을 Service로 추출합니다.

## 현재 상태

| 파일 | 문제 |
|------|------|
| CategoryController | `index()`와 `batchStatus()`에 80줄 이상 중복된 쿼리 로직, `levels()` 170줄 인라인, `runStep()` 오케스트레이션 인라인 |
| FolderController | 서비스 미사용, 모든 비즈니스 로직 인라인, Folder+Category 교차 모델 연산 |
| MyPageController | ✅ 레퍼런스 패턴 — 서비스 위임 |

## 구현 단계

### Phase 1: CategoryQueryService (static, 가장 낮은 리스크)
- `CategoryQueryService.php` 생성
- `applyUserScope()`, `applySearch()`, `applyFolderFilter()`, `applyStepsFilter()`, `buildListQuery()`
- `CategoryController::index()`와 `batchStatus()`에서 호출하도록 변경
- 기존 테스트 13개 통과 확인

### Phase 2: FolderService
- `FolderService.php` 생성
- `listForUser()`, `create()`, `rename()`, `delete()`, `hasCategories()`, `moveCategories()`
- `FolderController`에 생성자 주입
- 6개 메서드를 하나씩 리팩토링

### Phase 3: CategoryProcessingService
- `CategoryProcessingService.php` 생성
- `determineMissingSteps()`, `runStep()`, `updateText()`, `deleteWithEmbeddings()`
- `CategoryController`에 생성자 주입

### Phase 4: CategoryHierarchyService
- `CategoryHierarchyService.php` 생성
- `buildHierarchy()`, `computeMaxDepth()`, `extractOptions()`
- 내부적으로 `CategoryQueryService` static 메서드 재사용

### Phase 5: Cleanup
- `CategoryController`에서 `determineMissingSteps()` private 메서드 제거
- 생성자에 3개 서비스 주입
- 서비스 간 의존성 없음 확인

## 결과 (예상)

| 파일 | Before | After |
|------|--------|-------|
| CategoryController | 1034 | ~450 |
| FolderController | 350 | ~80 |
| CategoryQueryService | 0 | ~120 |
| CategoryProcessingService | 0 | ~110 |
| CategoryHierarchyService | 0 | ~130 |
| FolderService | 0 | ~180 |

## 검증

- `.claude/hooks/run-all-checks.sh --terminal` 실행 (tsc, lint, test, pint)
- 기존 Feature 테스트 모두 통과 확인
