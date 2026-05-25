# CosineDetailDialog 언어별 유사도 수정

## 개요

CosineDetailDialog "언어별 유사도" 섹션의 3가지 이슈 수정:
1. 제목-박스 간격 확대
2. 수평 3컬럼 → 수직 리스트 + 카테고리명 표시
3. 언어별 rank가 target language 기준 페이지 인덱스로 통일되는 버그 수정

## 문제 분석 (이슈 #3)

### 현상
"화장품/미용>클렌징>클렌징세트" 검색 시 카테고리코드 50000305:
- 한국어 "화장품/미용>헤어케어>헤어케어세트" → 3위
- 중국어 "化妆品/美容>头发护理>发型护理套装" → 20위

그러나 모달에서는 모든 언어가 동일한 rank(3위 또는 20위)로 표시됨.

### 원인
`RecommendResource.php:44`:
```php
'rank' => $score !== null ? $itemIndex + 1 : null,
```

`$itemIndex`는 `pageOffset + collectionIndex`로, target language 기준 정렬의 페이지네이션 위치. `similarity_score_ko`, `similarity_score_en`, `similarity_score_zh`는 각각 다른 distance에서 계산되므로, 각 언어별 실제 rank도 달라야 함.

### 해결
SQL 윈도우 함수로 언어별 실제 rank 계산:
```sql
RANK() OVER (ORDER BY ce_ko.embedding <=> ?::vector) as rank_ko,
RANK() OVER (ORDER BY ce_en.embedding <=> ?::vector) as rank_en,
RANK() OVER (ORDER BY ce_zh.embedding <=> ?::vector) as rank_zh
```

## 백엔드 변경

### RecommendationService::recommendPaginated()

- `selectRaw`에 3개 언어별 `RANK() OVER (...)` 추가
- `map()` 콜백에서 `$category->rank_{$lang}` 설정 추가

### RecommendResource

- `per_language_scores`의 `rank`를 `$this->{"rank_{$l}"}` 로 변경
- `$itemIndex` 기반 rank 계산 제거

## 프론트엔드 변경

### CosineDetailDialog

**간격 (이슈 #1):**
- 언어별 유사도 섹션 `space-y-1.5` → `space-y-2.5`

**레이아웃 (이슈 #2):**
- `grid grid-cols-3 gap-3` → `flex flex-col gap-2`
- 각 행 구성: `[언어명] [카테고리명] [유사도%] [순위뱃지]`
- 카테고리명: `result.category_name_ko`, `result.category_name_en`, `result.category_name_zh` 사용
- 현재 검색 언어는 primary border + ring 하이라이트 유지

## 테스트

- `RecommendResourceTest.php`: per_language_scores rank가 language별 독립적임을 검증
- `cosine-detail-dialog.test.tsx`: 수직 리스트 렌더링, 카테고리명 표시 확인
