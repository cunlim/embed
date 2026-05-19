# Admin 카테고리 코드 입력 필드 추가

## 개요

Admin 페이지의 카테고리 추가 폼에 카테고리 코드 입력 필드를 추가한다.
사용자가 직접 코드를 입력할 수 있고, 입력하지 않으면 자동 생성된다.

## 요구사항

1. **카테고리 코드 input 필드 추가** — "한국어 카테고리명" input 위에 배치
2. **required 아님** — placeholder: "입력하지 않을 시 자동 생성"
3. **중복 코드 검증** — 사용자 입력 코드가 DB에 존재하면 422 에러 반환 (등록 실패)
4. **자동 생성 코드 중복 방지** — 기존 `Category::generateCode()` 로직 유지 (3회 시도 후 throw)

## 변경 사항

### Backend (Laravel)

| 파일 | 변경 내용 |
|------|----------|
| `app/Http/Requests/CategoryStoreRequest.php` | `category_code` nullable string max:255 unique:categories,category_code 규칙 추가 |
| `app/Http/Controllers/Api/CategoryController.php` | `store()`에서 `$request->filled('category_code')`면 해당 값 사용, 아니면 `generateCode()` |

### Frontend (Next.js)

| 파일 | 변경 내용 |
|------|----------|
| `app/admin/page.tsx` | `newCategoryCode` state 추가. code input (name 위) + updated text |
| `hooks/useCategories.ts` | `addCategory()`에 `categoryCode?: string` 파라미터 추가 |
| `lib/api.ts` | `createCategory()`에 `categoryCode?: string` 파라미터 추가 |

## 데이터 흐름

```
사용자 입력 → admin/page.tsx (newCategoryCode 상태)
  → useCategories.addCategory(name, code)
    → api.createCategory(name, token, code)
      → POST /api/categories { category_name_ko, category_code? }
        → CategoryStoreRequest (unique 검증)
          → CategoryController.store()
            → category_code 있으면 사용, 없으면 generateCode()
```

## 검증

- 코드 미입력 → 자동 생성 (기존 동일)
- 코드 입력 + 중복 아님 → 해당 코드로 등록
- 코드 입력 + 중복 → 422 에러, 등록되지 않음, 화면에 에러 메시지
