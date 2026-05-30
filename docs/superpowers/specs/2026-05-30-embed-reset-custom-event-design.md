# 임베드 페이지 리셋 로직 개선 — 커스텀 이벤트 즉시 리셋

## 문제 정의

"기능시연" 링크(`/embed`) 클릭 시 URL 파라미터가 쌓인 상태에서 페이지가 정상적으로 초기화되지 않는 이슈.

### 재현된 이슈

1. **지연 문제**: "기능시연" 클릭 후 ~1초 동안 이전 필터 상태가 유지됨
   - URL이 빈 상태로 변경되기까지 800ms~1s 소요
   - 그 동안 이전 필터/데이터가 화면에 표시됨

2. **불일치 문제**: URL은 빈 상태인데 필터/데이터는 이전 상태 유지
   - 필터 버튼은 "내 카테고리"로 변경되지만 데이터는 이전 필터 기준

### 루트 원인

- "기능시연" `<Link href="/embed">`의 Next.js 클라이언트 라우팅이 ~1초 지연
- 리셋 효과(`useEffect`)가 `searchParams` 변경에 의존하므로 URL 변경 전 리셋 불가
- `loadCategories` 비동기 호출 중 이전 데이터가 화면에 잔류

## 해결 방안

**커스텀 이벤트를 통한 즉시 리셋**

1. "기능시연" 링크 클릭 시 `resetEmbedPage` 커스텀 이벤트 dispatch
2. `embed-page-inner.tsx`에서 이벤트 수신하여 즉시 모든 상태 리셋
3. 기존 URL 빈 상태 감지 리셋은 브라우저 뒤로가기용으로 유지

## 변경 대상

### 파일 변경

| 파일 | 변경 내용 |
|------|-----------|
| `nextjs/components/app-header.tsx` | "기능시연" `<Link>`에 `onClick` 핸들러 추가 |
| `nextjs/app/embed/embed-page-inner.tsx` | `resetToDefault()` 합수 분리 + 커스텀 이벤트 리스너 추가 |

### 상세 설계

#### 1. `resetToDefault()` 합수 (embed-page-inner.tsx)

기존 리셋 효과의 핵심 로직을 별도 합수로 분리:

```typescript
const resetToDefault = useCallback(() => {
  // 검색 상태 초기화
  setSearchText("");
  setSearchLanguage("ko");
  setSearchResults(null);
  setSearchMeta(null);
  setSearchError(null);
  setSearchPage(null);

  // 필터 상태 초기화
  setFilterSelection(null);
  setKeywordSearchActive(false);
  keywordRef.current = "";
  filterRef.current = null;

  // 페이지네이션 초기화
  setPerPage(20);

  // 계층 필터 완전 초기화
  setHierarchyResetKey((prev) => prev + 1);
  setHierarchyKeyword("");

  // URL 초기화
  router.replace("/embed", { scroll: false });

  // 카테고리 목록 리로드
  loadCategories(1, 20, undefined, "");
}, [loadCategories, router]);
```

#### 2. 커스텀 이벤트 리스너 (embed-page-inner.tsx)

```typescript
useEffect(() => {
  const handleResetEmbed = () => {
    resetToDefault();
  };
  window.addEventListener("resetEmbedPage", handleResetEmbed);
  return () => window.removeEventListener("resetEmbedPage", handleResetEmbed);
}, [resetToDefault]);
```

#### 3. "기능시연" 링크 이벤트 dispatch (app-header.tsx)

```typescript
<Link
  href="/embed"
  onClick={() => {
    window.dispatchEvent(new CustomEvent("resetEmbedPage"));
  }}
>
```

#### 4. 기존 리셋 효과 유지

URL 빈 상태 감지 리셋 로직(라인 318-355)은 그대로 유지. 브라우저 뒤로가기/앞으로가기 시 여전히 필요.

## 검증 방법

1. Playwright로 두 가지 이슈 시나리오 재테스트
2. "기능시연" 클릭 즉시 URL/필터/데이터 동기화 확인
3. 브라우저 뒤로가기 동작 정상 확인
4. `run-all-checks.sh` 실행으로 tsc/lint/test/pint 통과 확인

## 폴백

방안1으로 이슈가 해결되지 않으면 방안3(통합 리셋 합수 + 다중 트리거)으로 재작업.
