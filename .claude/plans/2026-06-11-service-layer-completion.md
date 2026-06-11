# 서비스 레이어 추출 완료 계획

## Context

acc430a~4b38543 커밋에서 서비스 레이어 추출이 80% 완료되었으나, 일부 메서드가 컨트롤러에 인라인되어 있습니다. 모바일 앱 재사용을 위해 나머지를 추출합니다.

## 변경 대상

### 1. `bulkUpload()` / `bulkDownload()` → `CategoryProcessingService`로 이동
- **현재**: CategoryController 240~373행에 파일 I/O + OpenSpout 로직 인라인
- **대상**: `CategoryProcessingService`에 `bulkUpload()` / `bulkDownload()` 메서드 추가
- **이유**: 컨트롤러는 HTTP 요청/응답만 담당해야 하며, 파일 파싱/생성은 비즈니스 로직

### 2. `store()` → `CategoryProcessingService`로 이동
- **현재**: CategoryController 456~477행에 카테고리 생성 로직 인라인
- **대상**: `CategoryProcessingService`에 `create()` 메서드 추가
- **이유**: 생성 로직을 서비스로 분리하면 모바일 앱에서도 동일 로직 재사용 가능

### 3. `batchStatus()`의 임베딩 존재 맵 쿼리 → `CategoryProcessingService`로 이동
- **현재**: CategoryController 128~140행에 임베딩 존재 여부 쿼리 인라인 (`batchRun()`과 중복)
- **대상**: `CategoryProcessingService`에 `getEmbeddingExistsMap()` 메서드 추가 후 양쪽에서 호출
- **이유**: 동일 쿼리가 두 곳에 중복되어 정책 변경 시 양쪽 모두 수정 필요

### 4. `CategoryHierarchyService::buildScopeQuery()` → `CategoryQueryService` 재사용
- **현재**: `buildScopeQuery()`에서 사용자 범위 로직을 독립 구현 (applyUserScope와 미묘한 차이 존재)
- **대상**: `buildScopeQuery()`에서 `CategoryQueryService::applyUserScope()` + `applyFolderFilter()` 호출
- **주의**: `applyUserScope()`는 `filter=my` 처리를 포함하지만, hierarchy에서는 불필요 — `applyUserScope()`에 `skipFilterMy` 파라미터 추가 또는 hierarchy 전용 경로 유지

## 구현 순서

1. `CategoryProcessingService`에 `getEmbeddingExistsMap()` 추가
2. `CategoryProcessingService`에 `create()` 추가
3. `CategoryProcessingService`에 `bulkUpload()` / `bulkDownload()` 추가
4. `CategoryHierarchyService::buildScopeQuery()`를 `CategoryQueryService` 메서드 재사용으로 변경
5. CategoryController에서 추출된 메서드 제거 + 서비스 호출로 대체
6. `.claude/hooks/run-all-checks.sh --terminal` 실행하여 검증

## 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `laravel/app/Services/CategoryProcessingService.php` | `getEmbeddingExistsMap()`, `create()`, `bulkUpload()`, `bulkDownload()` 추가 |
| `laravel/app/Services/CategoryQueryService.php` | `applyFolderFilter()`를 static으로 변경 (이미 static) + hierarchy 호환 확인 |
| `laravel/app/Services/CategoryHierarchyService.php` | `buildScopeQuery()`에서 CategoryQueryService 재사용 |
| `laravel/app/Http/Controllers/Api/CategoryController.php` | 인라인 로직 제거, 서비스 호출로 대체 |

## 검증

- `.claude/hooks/run-all-checks.sh --terminal` 실행 (tsc, lint, test, pint)
- 기존 Feature 테스트 모두 통과 확인
