# 폴더 기능 설계 문서

## 개요

embed 페이지에 **폴더** 기능을 추가하여 카테고리를 폴더별로 분류하고 관리할 수 있게 합니다.

## 데이터 모델

### categories 테이블 변경

- `folder` 컬럼 추가: `varchar(100)`, nullable, default NULL
- NULL = 기본폴더 (가상 폴더, 별도 행 없음)
- 복합 unique 인덱스 변경:
  - 기존: `(category_code, user_id)`
  - 변경: `(category_code, user_id, folder)` — partial unique index로 NULL 처리
  - `CREATE UNIQUE INDEX categories_code_user_folder_unique ON categories (category_code, user_id, COALESCE(folder, ''))`

### 폴더 목록 조회

별도 folders 테이블 없이 categories 테이블에서 파생:
```sql
SELECT DISTINCT folder FROM categories
WHERE user_id = ? AND folder IS NOT NULL
ORDER BY folder
```

## API 설계

### 폴더 목록 조회

```
GET /api/folders?user_id={userId}
```

- 인증 불필요 (범위 제어는 기존 규칙과 동일)
- 응답: `{ data: ["폴더A", "폴더B", ...] }`
- 관리자가 user_id 미지정 시 모든 사용자 폴더 반환 (optgroup용)

### 폴더 삭제

```
DELETE /api/folders/{folderName}?user_id={userId}&move_to_default={true|false}
```

- `move_to_default=true`: 해당 폴더 카테고리의 folder를 NULL로 변경
- `move_to_default=false`: 해당 폴더 카테고리도 함께 삭제
- 인증 필요 (본인 소유 또는 admin)

### 카테고리 목록 조회 (변경)

```
GET /api/categories?folder={folderName}&...
```

- `folder` 파라미터 추가
- `folder=기본폴더` → `WHERE folder IS NULL`
- `folder` 미지정 → 전체 (기존 동작 유지)

### 추천 API (변경)

```
POST /api/recommend
{ "folder": "폴더명", ... }
```

- `folder` 필드 추가
- RecommendationService에서 folder 조건 적용

### 카테고리 생성 (변경)

```
POST /api/categories
{ "folder": "폴더명", ... }
```

- `folder` 필드 추가 (선택)

### 카테고리 폴더 이동

```
POST /api/categories/move-folder
{ "category_ids": [1, 2, 3], "target_folder": "폴더명" | null }
```

- `target_folder`가 null이면 기본폴더로 이동
- "선택폴더이동": category_ids에 선택된 ID 전달
- "전체폴더이동": category_ids에 빈 배열 또는 별도 플래그

## 프론트엔드 설계

### 새 컴포넌트: FolderSection

**위치:** 유사도 검색 Card 상단 (독립 Card)

**UI 구성:**
```
┌─────────────────────────────┐
│ 📁 폴더                      │
│ ┌─────────────────────────┐ │
│ │ [회원 select] (관리자만) │ │
│ ├─────────────────────────┤ │
│ │ [폴더 select] ▼         │ │
│ │  ├ 전체 (기본)           │ │
│ │  ├ 기본폴더 (기울임)     │ │
│ │  ├ 쇼핑                  │ │
│ │  └ 의류                  │ │
│ ├─────────────────────────┤ │
│ │ [새 폴더명] [추가]       │ │
│ ├─────────────────────────┤ │
│ │ [선택이동] [전체이동]    │ │
│ │ [삭제]                   │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

**기본폴더 표기:**
- select에서 "기본폴더" 항목은 italic + muted 색상
- 새 폴더 이름 "기본폴더" 입력 방지 (validation)

### 관리자 회원 select

- 비로그인: 폴더 section 전체 숨김
- 일반 로그인: 회원 select 없음
- 관리자/최고관리자: 회원 select 표시
  - 디폴트: 로그인된 회원
  - 옵션: "전체" + 각 회원 목록
  - "전체" 선택 시: 폴더 select에 모든 회원의 폴더가 optgroup으로 그룹핑
  - 특정 회원 선택 시: 해당 회원의 폴더만 표시

### URL 파라미터

- `folder=폴더명`
- 폴더 변경 시: page=1, 필터(계층/검색) 초기화
- 유지: per_page, 전체/내카테고리

### 폴더 삭제 모달

삭제 확인 시 모달에서 선택:
- "기본폴더로 이동" (기본 선택)
- "카테고리도 함께 삭제"

## 영향받는 컴포넌트

| 컴포넌트 | 변경 내용 |
|----------|----------|
| `embed-page-inner.tsx` | FolderSection 추가, folder state 관리, URL 동기화 |
| `page.tsx` (SSR) | folder 파라미터 파싱, API 전달 |
| `embed-params.ts` | folder 파라미터 파싱 추가 |
| `api.ts` | folder 관련 타입/함수 추가 |
| `useCategories.ts` | folder 파라미터 전달 |
| `task-execution.tsx` | folder 범위 필터 전달 |
| `category-delete.tsx` | folder 범위 필터 전달 |
| `category-download.tsx` | folder 범위 필터 전달 |
| `category-hierarchy.tsx` | folder 변경 시 초기화 지원 |
| `bulk-upload.tsx` | 카테고리 생성 시 folder 전달 |
| `CategoryController.php` | folder 필터링, 폴더 CRUD |
| `RecommendController.php` | folder 필터링 |
| `RecommendationService.php` | folder 조건 추가 |

## 구현 순서

1. DB 마이그레이션 (folder 컬럼 + unique 인덱스)
2. 백엔드 API (폴더 CRUD + 기존 API folder 파라미터)
3. 프론트엔드 타입/함수 (api.ts)
4. FolderSection 컴포넌트
5. embed-page-inner.tsx 통합
6. SSR page.tsx 통합
7. 기존 컴포넌트 folder 전달
8. Playwright 테스트
9. run-all-checks.sh 검증
