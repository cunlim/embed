# 분류선택 언어 필터 설계

## 개요

embed 페이지의 "분류선택" 필터에 언어 radio button을 추가하여, 선택한 언어에 따라 계층 드롭다운을 재구성한다. 유사도 검색 언어(`slang`)도 radio toggle만으로 URL에 즉시 반영되도록 수정한다.

## 변경 범위

### 1. 백엔드: `CategoryController::levels()` 언어 파라미터 지원

**파일:** `laravel/app/Http/Controllers/Api/CategoryController.php`

- `lang` 쿼리 파라미터 추가 (`ko` | `en` | `zh`, 기본값 `ko`)
- `category_name_ko` 하드코딩 → `$langColumn` 변수로 동적 선택
- 영향 범위:
  - `$dbMaxDepth` 계산 (line 420): `string_to_array(category_name_ko, '>')` → `$langColumn`
  - 접두사 필터링 (line 427): `where('category_name_ko', ...)` → `$langColumn`
  - select/map (lines 433, 438, 465, 468, 484, 495, 501): 모두 `$langColumn`
- `lang` 값 검증: `in:ko,en,zh` — 잘못된 값은 400 응답

### 2. 프론트엔드: `fetchCategoryLevels()` API 함수

**파일:** `nextjs/lib/api.ts`

- `CategoryLevelsParams`에 `lang` 키 추가 전파 (이미 `Record<string, string>`이므로 별도 타입 변경 불필요)
- 호출부에서 `lang` 파라미터를 `params`에 포함하여 전달

### 3. 프론트엔드: URL 파라미터 `lang` 추가

**파일:** `nextjs/lib/embed-params.ts`

- `EmbedParams` interface에 `hierarchyLang: string` 필드 추가 (기본값 `"ko"`)
- `parseEmbedParams()`: `lang` 파라미터 읽기 (`ko` | `en` | `zh`, 기본값 `ko`)

### 4. 프론트엔드: `CategoryHierarchy` 컴포넌트에 언어 radio button

**파일:** `nextjs/components/admin/category-hierarchy.tsx`

- Props에 `lang`과 `onLangChange` 추가
- "분류선택" 모드일 때만 언어 radio button 3개 표시 (한국어/영어/중국어)
- 기존 유사도 검색의 pill button 스타일과 동일한 `getPillButtonClass` 사용
- 언어 변경 시:
  - `selectedPath` 초기화 (모든 드롭다운 선택 해제)
  - `levelOptions` 최상위만 남기고 초기화
  - `loadingStates` 초기화
  - 최상위 옵션을 새 언어로 재조회 (`fetchCategoryLevels`에 `lang` 전달)
  - `onKeywordSearch("")` 호출하여 카테고리 목록 초기화
  - `onLangChange(lang)` 호출하여 부모에 알림

### 5. 프론트엔드: `EmbedPageInner`에서 `lang` 상태 관리

**파일:** `nextjs/app/embed/embed-page-inner.tsx`

- `hierarchyLang` 상태: `useState(serverHierarchyLang ?? "ko")`
- `updateURL()`에 `hierarchyLang` 오버라이드 추가
  - `"ko"`가 아닐 때만 `lang` 파라미터 설정, `"ko"`이면 삭제
- `CategoryHierarchy`에 `lang={hierarchyLang}`과 `onLangChange` 전달
- `onLangChange` 핸들러: `setHierarchyLang(lang)` + `updateURL({ hierarchyLang: lang })`

### 6. SSR 프리페치

**파일:** `nextjs/app/embed/page.tsx`

- `parseEmbedParams`에서 `hierarchyLang` 추출
- `fetchCategoryLevels()` 호출 시 `lang` 파라미터 전달
- `serverHierarchyLang` prop으로 `EmbedPageInner`에 전달

### 7. `slang` URL 즉시 반영 수정

**파일:** `nextjs/app/embed/embed-page-inner.tsx`

- 현재: `slang`이 URL에 추가되는 시점은 유사도 검색 실행 시 (`handleSearch` 내 `updateURL`)
- 변경: 유사도 검색 radio button 클릭 시에도 즉시 `updateURL({ searchLanguage })` 호출
  - `setSearchLanguage` 호출부 (lines 597-617)에서 `updateURL`도 함께 호출
  - 검색 결과가 있으면 자동 재검색 유지 (기존 동작)
  - 검색 결과가 없어도 URL만 업데이트

## URL 파라미터 정리

| 파라미터 | 용도 | 기본값 | 삭제 조건 |
|---------|------|--------|----------|
| `lang` | 분류선택 계층 언어 | `ko` | `ko`일 때 삭제 |
| `slang` | 유사도 검색 언어 | `ko` | `ko`일 때 삭제 |

## 데이터 흐름

```
사용자: 언어 radio "영어" 클릭
  → CategoryHierarchy.onLangChange("en")
  → EmbedPageInner: setHierarchyLang("en") + updateURL({ hierarchyLang: "en" })
  → URL: /embed?lang=en
  → CategoryHierarchy 내부:
      selectedPath=[] 초기화
      fetchCategoryLevels({ lang: "en" }) → 새 옵션 로드
      onKeywordSearch("") → 카테고리 목록 초기화

사용자: 페이지 새로고침
  → SSR: parseEmbedParams → hierarchyLang="en"
  → fetchCategoryLevels({ lang: "en" }) 프리페치
  → serverHierarchyLang="en" 전달
  → 클라이언트: 초기 언어 "en"으로 렌더링
```

## 하위 호환성

- `lang` 미지정 시 기존 동작과 동일 (`ko`)
- 기존 `slang` 동작 유지 (검색 실행 시에도 여전히 URL에 반영)
- 백엔드 API: `lang` 미지정 시 `category_name_ko` 사용 (기존 동작)
