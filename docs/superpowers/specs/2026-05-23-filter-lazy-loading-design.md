# 필터 섹션 SSR + 단계별 API 로딩 설계

## 문제

1. **성능**: `/api/categories/levels`가 4,825개 카테고리 전체를 한 번에 반환 (~900KB JSON). 초기화 버튼 클릭 시 `useMemo` 재계산에 1.5초 소요.
2. **Layout Shift**: 필터 섹션이 클라이언트에서만 렌더링되어 초기 HTML에 내용이 없고, API 응답 후 200KB+ HTML이 주입되며 높이가 급증.

## 해결 방향

- 대 옵션은 SSR로 prefetch하여 초기 HTML에 포함
- URL에 cat1/cat2/cat3이 있으면 해당 깊이까지 prefetch
- 단계 선택 시 백엔드에 해당 깊이의 옵션만 요청

## API 변경

### 엔드포인트: `GET /api/categories/levels`

| 쿼리 파라미터 | 응답 | 예시 |
|---|---|---|
| (없음) | 대 목록 | `{ "data": { "대": ["패션의류", "식품", ...] } }` |
| `?대=패션의류` | 중 목록 | `{ "data": { "중": ["여성의류", "남성의류", ...] } }` |
| `?대=패션의류&중=여성의류` | 소 목록 | `{ "data": { "소": ["원피스", "티셔츠", ...] } }` |
| `?대=...&중=...&소=...` | 세 목록 | `{ "data": { "세": [{ "세": "미니원피스", "categoryId": 1, "categoryCode": "..." }, ...] } }` |

### Backend: `CategoryController::levels()`

```php
public function levels(Request $request): JsonResponse
{
    $대 = $request->query('대');
    $중 = $request->query('중');
    $소 = $request->query('소');

    $query = Category::query()->where('user_id', 1);

    if ($대 !== null) {
        $parts = count(array_filter([$대, $중, $소], fn($v) => $v !== null));
        // parts 단계까지 필터링 후 다음 단계 옵션 추출
    }

    if ($대 === null) {
        // 대 목록만 반환
        return response()->json(['data' => ['대' => [...]]]);
    }
    // ... 단계별 분기
}
```

## 프론트엔드 변경

### Server Component (app/embed/page.tsx)

- `searchParams`에서 `cat1`, `cat2`, `cat3` 읽기
- 대 옵션 항상 prefetch
- cat1→중 prefetch, cat2→소 prefetch
- 모든 prefetch 결과를 Client Component에 props로 전달

### CategoryHierarchy 컴포넌트

- `initial대Options`, `initial중Options`, `initial소Options`, `initial세Options` props 추가
- 단계 선택 핸들러가 `fetchCategoryLevels({대: ...})` 호출
- 초기화 버튼은 상태만 초기화 (대 옵션은 SSR props 유지)
- `useCategoryHierarchy` 훅 제거하고 로직을 컴포넌트로 통합

### API 클라이언트 (lib/api.ts)

```typescript
interface CategoryLevelsParams {
  대?: string;
  중?: string;
  소?: string;
}

interface CategoryLevelsResponse {
  대?: string[];
  중?: string[];
  소?: string[];
  세?: { 세: string; categoryId: number; categoryCode: string }[];
}

function fetchCategoryLevels(params?: CategoryLevelsParams): Promise<{ data: CategoryLevelsResponse }>
```

## 동작 흐름

1. 사용자가 `/embed` 접속 → Server Component가 대 옵션 prefetch
2. HTML에 대 `<select>`와 `<option>`들이 이미 포함된 상태로 전달
3. 사용자가 대 선택 → `fetchCategoryLevels({대: "패션의류"})` → 중 옵션 수신 및 렌더링
4. 사용자가 중 선택 → `fetchCategoryLevels({대: "패션의류", 중: "여성의류"})` → 소 옵션 수신
5. 초기화 → state만 null로, API 호출 없음 (대 옵션은 이미 있음)

## 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `laravel/app/Http/Controllers/Api/CategoryController.php` | `levels()` 메서드 재작성: 쿼리 파라미터 기반 필터링 |
| `nextjs/lib/api.ts` | `fetchCategoryLevels` 시그니처 변경, 새 응답 타입 |
| `nextjs/app/embed/page.tsx` | Server Component로 초기 데이터 prefetch, Client Component에 props 전달 |
| `nextjs/components/admin/category-hierarchy.tsx` | props 기반 초기 옵션, 단계별 API 호출, useCategoryHierarchy 의존성 제거 |
| `nextjs/hooks/useCategoryHierarchy.ts` | 제거 |
| `laravel/tests/Feature/CategoryLevelsTest.php` | 새 파라미터 케이스 테스트 추가 |
| `nextjs/hooks/__tests__/useCategoryHierarchy.test.ts` | 제거 또는 대체 |
| `nextjs/lib/__tests__/category.test.ts` | `fetchCategoryLevels` 새 시그니처 테스트 |

## 테스트 계획

### Backend
- `GET /api/categories/levels` → 대 목록 정상 반환
- `GET /api/categories/levels?대=X` → 중 목록 정상 반환
- `GET /api/categories/levels?대=X&중=Y` → 소 목록 정상 반환
- `GET /api/categories/levels?대=X&중=Y&소=Z` → 세 목록 정상 반환
- 빈 결과 케이스

### Frontend
- `fetchCategoryLevels()` 단위 테스트
- CategoryHierarchy: SSR props로 초기 렌더링 확인
- CategoryHierarchy: 대 선택 후 중 옵션 로딩 확인
- 초기화 버튼이 API 호출 없이 상태만 초기화하는지 확인
