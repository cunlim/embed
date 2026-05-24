# embed 페이지 filter·유사도검색 URL-SSR 연동

## 개요

"전체/내카테고리" 필터와 "유사도 검색" 상태를 URL 파라미터에 포함시키고 SSR에서도 처리.

## URL 파라미터 확장

| 파라미터 | 값 | 설명 |
|---|---|---|
| `filter` | `my` 또는 absent | 내카테고리 / 전체 |
| `stext` | string | 유사도 검색어 |
| `slang` | `ko` / `en` / `zh` | 검색 언어 |

기존 `mode`, `cat1`~`4`, `q`, `page`, `per_page`는 그대로 유지.

## 데이터 흐름

### SSR (page.tsx)

1. `parseEmbedParams(reader)`로 모든 URL 파라미터를 한 번에 추출
2. `filter`를 `getCategories(token, page, perPage, filter, keyword)`에 전달
3. `stext` 존재 시 `recommend(stext, slang, token)` 호출, 결과를 props로 전달
4. 추가 props: `serverFilter`, `serverSearchResults`, `serverSearchMeta`, `serverSearchText`, `serverSearchLang`

### 클라이언트 (embed-page-inner.tsx)

1. `filter` state 초기값을 URL `filter` 파라미터에서 읽음
2. `searchText`, `searchLanguage` 초기값을 URL `stext`·`slang`에서 읽음
3. SSR 검색 결과(`serverSearchResults`)가 있으면 `searchResults` 초기값으로 사용
4. "전체"/"내카테고리" 버튼 → URL 업데이트 (router.replace)
5. "검색" 버튼 → `stext`·`slang`을 URL에 반영
6. `handleFilterChange`에 `filter` 파라미터 추가

### 공유 유틸리티 (embed-params.ts)

`parseEmbedKeyword`를 `parseEmbedParams`로 확장:
```typescript
interface EmbedParams {
  mode: "hierarchy" | "search"
  keyword: string | null    // hierarchy(">") 또는 q
  filter: string | undefined // "my" 또는 undefined
  searchText: string | null  // stext
  searchLang: string         // slang (기본 "ko")
}
```

## 변경 파일

| 파일 | 변경 |
|---|---|
| `lib/embed-params.ts` | `parseEmbedKeyword` → `parseEmbedParams` 확장 |
| `app/embed/page.tsx` | filter + search 파라미터 처리, recommend prefetch |
| `app/embed/embed-page-inner.tsx` | filter 동기화, search URL 연동, SSR search 초기화 |
| `app/embed/__tests__/page.test.tsx` | 새 props 반영 |

## 테스트

- `parseEmbedParams` 유닛 테스트 추가
- `EmbedPageInner` 테스트에 새 props 추가
- Playwright로 URL-SSR 연동 확인
