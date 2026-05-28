# 동적 카테고리 깊이 설계

## 배경

현재 카테고리 필터는 대/중/소/세 4단계로 고정되어 있으나, DB에는 5단계 이상의 카테고리가 존재한다. 접근 가능한 전체 카테고리를 실시간으로 통계하여 필터 깊이를 동적으로 결정해야 한다.

## 목표

- "대중소세", "4단계" 개념을 프로젝트에서 완전 제거
- DB에서 실시간으로 최대 깊이를 계산하여 해당 깊이만큼 필터 노출
- 사용자 권한에 따라 계산되는 maxDepth가 달라짐
- 무한 깊이 확장 가능

## 백엔드 설계

### API 변경: `GET /api/categories/levels`

**요청 파라미터** (catN 기반, depth 파라미터 없음):

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| (없음) | - | 최상위(depth 0) 목록 반환 |
| `cat1` | string | depth 1 목록 (cat1의 자식) |
| `cat1&cat2` | string | depth 2 목록 |
| `cat1&cat2&cat3` | string | depth 3 목록 |
| ... | string | 임의 깊이 확장 가능 |

깊이는 전달된 `catN` 파라미터 개수로 자동 판단. catN은 cat1부터 순차적으로 전달하며, 최대 노출 깊이는 `category.max_depth` 설정값으로 제한.

**응답 형식**:

```json
{
  "data": {
    "options": ["원피스", "블라우스", ...],
    "maxDepth": 5,
    "isLeaf": false,
    "leafCategoryId": null
  }
}
```

- `options`: 현재 depth에서 선택 가능한 값 목록 (중복 제거)
- `maxDepth`: 접근 가능한 카테고리 기준 실시간 최대 깊이
- `isLeaf`: 현재 prefix가 리프 카테고리인지 (자식 없음)
- `leafCategoryId`: 리프일 경우 카테고리 ID

**maxDepth 계산 규칙** (기존 user scope 규칙과 동일):

```sql
-- 비로그인
SELECT max(array_length(string_to_array(category_name_ko, '>'), 1))
FROM categories WHERE user_id = 1;

-- 로그인(일반)
SELECT max(array_length(string_to_array(category_name_ko, '>'), 1))
FROM categories WHERE user_id IN (:userId, 1);

-- admin/superadmin
SELECT max(array_length(string_to_array(category_name_ko, '>'), 1))
FROM categories;
```

**기존 하위 호환**: 기존 `대/중/소/세` 쿼리 파라미터는 deprecated 경고와 함께 `cat1/cat2/cat3/cat4`로 내부 변환. 프론트엔드는 신규 파라미터만 사용.

### 설정: `category.max_depth`

settings 테이블의 `category` 그룹에 `max_depth` 추가. 관리자 페이지에서 변경 가능.

| group | key | 기본값 | 타입 | 설명 |
|-------|-----|--------|------|------|
| category | max_depth | 10 | integer | 필터로 노출할 최대 깊이 |

- `maxDepth` 응답값 = `min(DB실제최대깊이, category.max_depth)`
- 설정값이 5이면, DB에 7단계 카테고리가 있어도 5단계까지만 필터 노출

### 초과 깊이 처리 규칙

카테고리 깊이가 `max_depth`를 초과하는 경우:

- 필터는 `max_depth`단계까지만 노출
- 마지막 단계의 카테고리 텍스트는 `>` 이후의 나머지 전체 텍스트를 포함
- 예시 (`max_depth=4`):
  - DB 카테고리: `테스트4>테스트41>테스트411>테스트4111>테스트411112`
  - 4단계 Select에서 "테스트4111" 선택 시, 키워드는 `테스트4>테스트41>테스트411>테스트4111>테스트411112`로 전달 (LIKE 검색)
  - 또는, 마지막 단계의 옵션 목록에 `테스트4111 > 테스트411112` 형태로 표시

### 변경 파일

- `laravel/app/Http/Controllers/Api/CategoryController.php` — `levels()` 메서드 전면 수정
- `laravel/database/seeders/SettingsSeeder.php` — `category.max_depth` 추가
- `laravel/routes/api.php` — 라우트 변경 없음 (기존 `/categories/levels` 유지)
- `laravel/tests/Feature/CategoryApiTest.php` — 새 테스트 추가

## 프론트엔드 설계

### API 클라이언트 변경

**`nextjs/lib/api.ts`**:

```typescript
// 기존 — 제거
export interface CategoryLevelsParams { 대?: string; 중?: string; 소?: string; }
export interface CategoryLevelsResponse { 대?: string[]; 중?: string[]; 소?: string[]; 세?: {...}[]; }

// 신규
export interface CategoryLevelsParams {
  cat1?: string;
  cat2?: string;
  cat3?: string;
  cat4?: string;
  cat5?: string;
  // ...필요시 확장
}

export interface CategoryLevelsResponse {
  options: string[];
  maxDepth: number;
  isLeaf: boolean;
  leafCategoryId: number | null;
}
```

### 상태 구조 변경

```typescript
// 기존 — 제거
interface HierarchyFilterState {
  대: string | null; 중: string | null; 소: string | null; 세: string | null;
}

// 신규
type HierarchyFilterState = (string | null)[];
// 예: ["의류", "여성의류", "원피스", null, null]
// 인덱스가 depth, 값이 선택된 카테고리명
```

### CategoryHierarchy 컴포넌트 변경

- `maxDepth`를 API에서 받아와 그 수만큼 Select 동적 생성
- 각 Select는 상위 선택 시 하위 옵션을 비동기 로드
- 상위 선택 변경 시 하위 Select 모두 초기화 (기존 동작 유지)
- 로딩 상태도 동적 배열로 관리
- `initial대Options`, `initial중Options`, `initial소Options`, `initial세Options` props → `initialLevelOptions: string[][]` 단일 prop
- SSR prefetch에서 `maxDepth` 조회 후 해당 깊이만큼 초기 옵션 전달

### URL 파라미터

- 기존 `cat1~cat4` 유지, 필요시 `cat5`, `cat6`... 확장
- URL 파싱: `catN` 키를 순회하여 자동 감지
- `embed-params.ts`에서 `cat1~catN` 파싱 로직 변경

### 변경 파일

- `nextjs/lib/api.ts` — `CategoryLevelsParams`, `CategoryLevelsResponse`, `fetchCategoryLevels` 변경
- `nextjs/lib/category.ts` — `HierarchyLevel` 제거, `parseHierarchy` 제거 또는 변경
- `nextjs/lib/embed-params.ts` — catN 파라미터 동적 파싱
- `nextjs/components/admin/category-hierarchy.tsx` — 전면 수정 (동적 Select)
- `nextjs/app/embed/page.tsx` — SSR prefetch 로직 변경
- `nextjs/app/embed/embed-page-inner.tsx` — 상태 구조, URL 업데이트 로직 변경
- `nextjs/app/page.tsx` — "4단계 계층 필터링" → "동적 계층 필터링" 텍스트 변경

## 제거 대상

프로젝트에서 완전히 제거해야 할 개념:

1. `대/중/소/세` 인터페이스 필드명 → 인덱스 기반 배열로 대체
2. `HierarchyLevel` 인터페이스 → 제거
3. `cat1~cat4` 고정 → `catN` 동적 확장
4. "4단계" 하드코딩 → `maxDepth` 기반 동적 생성
5. `initial대Options`, `initial중Options`, `initial소Options`, `initial세Options` props → `initialLevelOptions` 단일 prop

## 테스트 전략

- 백엔드: 깊이별 levels API 응답 검증, maxDepth 계산 검증, 리프 카테고리 검증
- 프론트엔드: Select 동적 생성, 상위 선택 시 하위 초기화, URL 동기화
