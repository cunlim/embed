# Embed 페이지 필터 검색 확장 및 엑셀 다운로드 디자인

## 개요

embed 페이지의 필터 섹션에 카테고리코드 검색 기능을 추가하고, 삭제 섹션의 제목을 제거하며 엑셀 다운로드 기능을 추가한다.

## 1. 카테고리코드 검색

### 백엔드 변경

**파일**: `laravel/app/Http/Controllers/Api/CategoryController.php`

현재 `search` 파라미터는 `category_name_ko`만 LIKE 검색한다. 이를 `category_code`도 함께 검색하도록 확장한다.

```php
// 변경 전
if ($request->filled('search')) {
    $query->where('category_name_ko', 'LIKE', '%'.$request->input('search').'%');
}

// 변경 후
if ($request->filled('search')) {
    $search = $request->input('search');
    $query->where(function ($q) use ($search) {
        $q->where('category_name_ko', 'LIKE', '%'.$search.'%')
          ->orWhere('category_code', 'LIKE', '%'.$search.'%');
    });
}
```

### 프론트엔드 변경

**파일**: `nextjs/components/admin/category-hierarchy.tsx`

- "검색" 모드의 입력란 플레이스홀더를 `"카테고리명 또는 코드 검색..."`으로 변경
- 별도 UI 컴포넌트 추가 없이 기존 입력란이 백엔드의 확장된 검색을 활용

## 2. 엑셀 다운로드

### 새 컴포넌트

**파일**: `nextjs/components/admin/category-download.tsx`

기존 `CategoryDelete` 컴포넌트와 같은 위치에 배치하거나, `CategoryDelete` 내부에 통합한다.

### 기능

#### 선택다운로드
- `selectedIds`에 해당하는 카테고리를 API에서 조회
- 엑셀 생성: `category_code | category_ko | category_en | category_zh` 4열
- 헤더는 업로드 양식과 동일하게 `category_code`, `category_ko` (필수), `category_en`, `category_zh` (선택)

#### 전체다운로드
- 현재 필터/검색 조건에 맞는 전체 카테고리를 API에서 조회
- `getCategories(token, 1, 100000, filter, keyword)` 활용 (기존 `CategoryDelete`의 전체삭제와 동일 방식)
- 동일한 4열 엑셀 생성

### 엑셀 생성 방식

- `xlsx` 라이브러리 사용 (현재 `BulkUpload`에서 이미 사용 중)
- 워크시트 생성 후 `XLSX.writeFile()` 또는 `XLSX.write()`로 다운로드

### 엑셀 컬럼 구조

| Column A | Column B | Column C | Column D |
|---|---|---|---|
| `category_code` | `category_ko` | `category_en` | `category_zh` |
| 선택 (코드) | 필수 (한국어명) | 선택 (영어명) | 선택 (중국어명) |

## 3. 삭제 섹션 UI 변경

### 현재 구조
```
<h3>삭제</h3>
[선택삭제] [전체삭제]
[진행률 표시]
```

### 변경 후 구조
```
[선택다운로드] [전체다운로드]
[선택삭제]    [전체삭제]
[진행률 표시]
```

- "삭제" 섹션 `<h3>` 제목 제거
- 상단에 다운로드 버튼 2개 배치
- 하단에 삭제 버튼 2개 배치
- 기존 삭제 진행률 표시(`Progress`)는 유지

### 구현 위치

`CategoryDelete` 컴포넌트 내부에 다운로드 버튼을 추가하거나, 별도 `CategoryDownload` 컴포넌트를 만들고 `embed-page-inner.tsx`에서 함께 렌더링한다.

## 4. 파일 변경 목록

| 파일 | 변경 내용 |
|---|---|
| `laravel/app/Http/Controllers/Api/CategoryController.php` | `search` 파라미터에 `category_code` OR 조건 추가 |
| `nextjs/components/admin/category-hierarchy.tsx` | 검색 입력란 플레이스홀더 변경 |
| `nextjs/components/admin/category-delete.tsx` | 제목 제거 + 다운로드 버튼 추가 |
| `nextjs/lib/api.ts` | 다운로드용 API 함수 추가 (필요 시) |

## 5. 테스트

1. 카테고리코드로 검색 시 해당 코드를 가진 카테고리가 결과에 포함되는지 확인
2. 카테고리명으로 검색 시 기존 동작이 유지되는지 확인
3. 선택다운로드 시 선택된 항목만 엑셀에 포함되는지 확인
4. 전체다운로드 시 필터 조건에 맞는 전체 항목이 엑셀에 포함되는지 확인
5. 다운로드된 엑셀의 헤더가 업로드 양식과 일치하는지 확인
6. 다운로드된 엑셀을 업로드 시 정상 동작하는지 확인
