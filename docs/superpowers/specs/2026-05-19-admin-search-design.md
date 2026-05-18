# 관리자 페이지 검색 기능 설계

## 목적

`/embed` 페이지의 pgvector 의미 기반 유사도 검색 로직을 `/admin` 페이지에도 적용한다.
검색 결과는 기존 카테고리 목록 UI를 재사용하며, 선택한 언어에 따라 해당 언어 필드의 카테고리명을 출력한다.

## 변경 범위

### 백엔드

#### `POST /api/recommend` — 페이지네이션 + text nullable

**RecommendRequest** (`laravel/app/Http/Requests/RecommendRequest.php`)
- `text`: `required` → `nullable|string|max:500`
- `page`, `per_page` 파라미터 추가 (기본값: page=1, per_page=20)

**RecommendController** (`laravel/app/Http/Controllers/Api/RecommendController.php`)
- `text`가 비어있으면: 일반 카테고리 목록 반환 (language 필드 기준 정렬, 페이지네이션)
- `text`가 있으면: pgvector 유사도 검색 + 페이지네이션

**RecommendationService** (`laravel/app/Services/RecommendationService.php`)
- `recommendPaginated()` 메서드 추가: Category + CategoryEmbedding JOIN으로 distance 계산 + `paginate()`
- 기존 `recommend()` 메서드 유지 (embed 페이지 호환)

**RecommendResource** (`laravel/app/Http/Resources/RecommendResource.php`)
- `id`, `category_code`, `category_name_ko`, `category_name_zh`, `category_name_en`, `category_name`(동적 매핑), `translation_status`, `similarity_score` 포함
- embed 페이지는 `category_name`으로 기존 호환 유지

#### 응답 형식

**text 있음 (유사도 검색):**
```json
{
  "data": [
    {
      "id": 1,
      "category_code": "001",
      "category_name_ko": "의류>여성의류>원피스",
      "category_name_zh": null,
      "category_name_en": null,
      "category_name": "의류>여성의류>원피스",
      "translation_status": "completed",
      "similarity_score": 0.92
    }
  ],
  "meta": { "current_page": 1, "last_page": 5, "total": 85, "per_page": 20, "from": 1, "to": 20 }
}
```

**text 없음 (일반 목록):**
`similarity_score: null`, `meta`는 기존 카테고리 목록과 동일.

### 프론트엔드

#### API 타입/함수 (`nextjs/lib/api.ts`)

- `Recommendation` 인터페이스: `id`, `category_name_ko/zh/en`, `translation_status` 추가
- `RecommendResponse`: `meta: PaginationMeta` 추가
- `recommend()` 함수: `page`, `perPage` 파라미터 추가

#### 좌측 사이드바 — 검색 섹션 (신규, `admin/page.tsx`)

"카테고리 추가" Card 위에 새 Card 삽입:

```
┌──────────────────────┐
│  카테고리 검색         │
│                      │
│  [한국어|중국어|영어]  │
│                      │
│  ┌──────────────────┐│
│  │ 검색어 입력...     ││
│  └──────────────────┘│
│                      │
│  [Search 검색] [X]   │
└──────────────────────┘
```

- Language 탭 변경: 아무 액션 없음, UI만 전환
- 검색 버튼 (Search 아이콘 + "검색" 텍스트): text="" → 일반 목록, text!="" → 유사도 검색
- 초기화 버튼 (X icon, text 입력 있을 때만 표시): 검색어 제거
- `searchText`, `searchLanguage` 지역 state 관리

#### 우측 카테고리 목록 — 검색 모드 지원

- 일반 모드 컬럼: `카테고리` → `상태` → `보기`
- 검색 모드 컬럼: `카테고리` → `유사도` → `상태` → `보기`
  - 유사도: `(similarity_score * 100).toFixed(1)%`
- `카테고리` 컬럼: 검색 모드의 searchLanguage에 따라 `category_name_ko/zh/en` 선택
- 데이터 소스: 일반 모드는 `useCategories` 결과, 검색 모드는 지역 `searchResults`/`searchMeta`
- 페이지네이션: 검색 모드에서는 recommend API page 파라미터 변경으로 재검색

#### 데이터 흐름

```
Language 탭 변경 → 아무 액션 없음 (searchLanguage state만 업데이트)
검색 버튼(text="" ) → GET /api/categories (language 필드 정렬)
검색 버튼(text!="") → POST /api/recommend { text, target_language, page } → 유사도 + 페이지네이션
초기화 버튼 → setSearchText(""), 검색 결과 유지
페이지 변경(검색 모드) → re-recommend({ ...same, page: N })
```

#### 상태 관리

| 상태 | 처리 |
|------|------|
| 로딩 | Skeleton (기존 목록과 동일) |
| 에러 | Alert + 재시도 버튼 |
| 빈 검색 결과 | "검색 결과가 없습니다" |
| 검색어 없이 검색 | 일반 목록 표시 (현재와 동일) |

### 컴포넌트 변경

#### StatusBadge (`components/admin/status-badge.tsx`)

| 상태 | 아이콘 | 색상 |
|------|--------|------|
| completed | CheckCircle2 | text-green-500 |
| partial | Clock | text-blue-500 (AlertTriangle → Clock, 경고 느낌 제거) |
| pending | Minus | text-muted-foreground |

텍스트("처리완료", "일부처리", "처리안됨") 제거, 아이콘만 표시.

## 테스트 계획

### 백엔드 (Pest)
- `RecommendControllerTest`: text="" 시 일반 목록 반환 검증, text 있을 시 유사도 검색 + 페이지네이션 검증
- `RecommendationServiceTest`: `recommendPaginated()` JOIN + distance 계산 검증

### 프론트엔드 (Vitest)
- `api.test.ts`: recommend() 호출 시 page/per_page 파라미터 전달 검증
- `admin/page.test.tsx`: 검색/초기화 버튼 동작, 검색 모드 UI 전환 검증
