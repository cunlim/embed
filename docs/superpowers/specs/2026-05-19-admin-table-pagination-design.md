# Admin 페이지 테이블 및 페이지네이션 개선 설계

**날짜:** 2026-05-19
**상태:** 승인됨

## 개요

Admin 페이지의 두 가지 UI 이슈를 수정한다:
1. 테이블 컬럼 너비가 고정되지 않고 긴 텍스트가 줄임표 처리되지 않음
2. 페이지네이션이 모든 페이지 번호를 표시하여 사용 불가능

## 1. 테이블 컬럼 너비 고정 및 줄임표

### 변경 파일

`nextjs/app/admin/page.tsx`

### 변경 내역

| 항목 | 현재 | 변경 |
|------|------|------|
| `<Table>` | `<Table>` | `<Table className="table-fixed">` |
| 이름 `<TableCell>` | `<TableCell className="font-medium">` | `<TableCell className="max-w-0 w-full truncate font-medium">` |
| 상태 `<TableHead>` | `className="w-[100px]"` | `className="w-[80px]"` |
| 보기 `<TableHead>` | `className="w-[60px]"` | `className="w-[52px]"` |
| 보기 `<TableCell>` | `<TableCell>` | `<TableCell className="text-center">` |

### 핵심 원리

- `table-fixed`가 있어야 `truncate`(`overflow:hidden; text-overflow:ellipsis; white-space:nowrap`)가 동작한다
- `max-w-0 w-full`로 이름 컬럼이 남은 공간을 가득 채우면서도 오버플로우 시 줄임표가 적용된다
- 상태/보기 컬럼은 고정 너비로 tight하게 유지

## 2. 페이지네이션 compact + 페이지 크기 선택기

### 변경 파일

`nextjs/app/admin/page.tsx`

### 페이지 범위 로직

`getPageRange(current, last)` 유틸 함수:
- 현재 페이지 ±2 범위 표시
- 첫 페이지(1)와 마지막 페이지(last) 항상 표시
- 범위 사이에 `'...'` 마커 삽입
- 예: `[1, '...', 4, 5, 6, '...', 242]`

### PaginationEllipsis 동작

`•••` 클릭 시 다음/이전 5페이지 블록으로 이동:
- 왼쪽 `•••` → `current - 5` (최소 1)
- 오른쪽 `•••` → `current + 5` (최대 last)

### 페이지 크기 선택기

```tsx
<select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); loadCategories(1, Number(e.target.value)); }}>
  <option value={10}>10 / page</option>
  <option value={20}>20 / page</option>
  <option value={50}>50 / page</option>
</select>
```

### 추가 상태

- `perPage`: number (기본값 10)
- `loadCategories(page, perPage)` 호출 시 `per_page` 파라미터 전달

## 3. 백엔드 확인 필요

`GET /api/categories`가 `per_page` 쿼리 파라미터를 이미 지원하는지 확인 (`lib/api.ts`의 `getCategories` 함수 시그니처 확인).

## 범위 제한

- 모바일 카드 뷰(`md:hidden`)는 기존 동작 유지 (이미 truncate 적용됨)
- 검색 모드 페이지네이션도 동일한 compact 스타일 적용
- StatusBadge 컴포넌트는 변경하지 않음
