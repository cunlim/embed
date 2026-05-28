# 카테고리 삭제 섹션 디자인

## 배경

embed 페이지에 "작업 실행" 섹션 아래에 카테고리 삭제 기능을 추가합니다. 기존 개별 삭제 버튼의 권한 패턴(`canModify`)을 따르며, 선택삭제와 전체삭제 두 가지 버튼을 제공합니다. 또한 기존 "전체처리" 버튼의 범위를 CategoryHierarchy 필터까지 적용하도록 수정하여 삭제와 처리 범위를 통일합니다.

## 변경 범위

### 1. 필터 상태 전달 (`embed-page-inner.tsx`)

- CategoryHierarchy의 `onFilterChange` 콜백에서 keyword를 state로 저장
- TaskExecution과 삭제 컴포넌트에 `keyword` prop 전달
- `keywordRef.current` 대신 CategoryHierarchy에서 받은 keyword 사용

### 2. TaskExecution 수정 (`components/admin/task-execution.tsx`)

- `keyword` prop 추가
- `handleFullProcess`에서 `getCategories(token, 1, 100000, filter, keyword)` 호출
- "선택처리", "전체처리" 버튼 클릭 시 확인 알림 추가

### 3. 삭제 컴포넌트 신규 (`components/admin/category-delete.tsx`)

- TaskExecution과 동일한 패턴의 Card 컴포넌트
- Props: `token`, `selectedIds`, `categories`, `filter`, `keyword`, `canModify`, `onComplete`, `onCategoryComplete`
- 두 버튼: 선택삭제 (outline), 전체삭제 (destructive)
- 진행률 바 + 완료/실패 카운트

### 4. 확인 알림 (4개 버튼 공통)

| 버튼 | 확인 메시지 |
|------|------------|
| 선택처리 | "선택한 N개 카테고리를 처리하시겠습니까?" |
| 전체처리 | "현재 필터에 해당하는 N개 카테고리를 처리하시겠습니까?" |
| 선택삭제 | "선택한 N개 카테고리를 삭제하시겠습니까?" |
| 전체삭제 | "현재 필터에 해당하는 N개 카테고리를 삭제하시겠습니까?" |

- 선택 버튼: `selectedIds` 중 `canModify` 개수 즉시 표시
- 전체 버튼: `getCategories` 호출로 대상 수 조회 후 표시

### 5. UI 레이아웃

사이드바 순서:
```
[유사도 검색]
[필터]
[추가]
[작업 실행]      ← 기존 (확인 알림 추가)
[삭제]           ← 신규
```

## 권한 규칙

- `canModify(cat)`: `isAdmin(user) || category.user_id === user.id`
- 선택삭제: `selectedIds` 중 `canModify`인 것만 삭제
- 전체삭제: 현재 필터(category hierarchy + 전체/내 카테고리) 결과 중 `canModify`인 것만 삭제

## 삭제 API

- 단일 삭제: `DELETE /categories/${id}` (기존 `deleteCategory` API 재사용)
- bulk delete API 없음 → 순차 삭제

## 테스트

- 선택삭제: 선택된 카테고리가 삭제되는지 확인
- 전체삭제: 필터 조건에 맞는 카테고리만 삭제되는지 확인
- 권한: 다른 사용자의 카테고리는 삭제 불가 확인
- 확인 알림: 클릭 시 영향받는 수 표시 확인
- 진행률: 삭제 진행 상황 표시 확인
