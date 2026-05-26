# CosineDetailDialog 언어별 유사도 표시

## 개요

CosineDetailDialog 모달 하단에 카테고리의 3개 언어(ko, en, zh)별 유사도 점수와 순위를 수평 3컬럼으로 표시. 현재 검색 언어를 ring/border + 그림자로 강조.

## 백엔드

### RecommendationService::recommendPaginated()

- 기존: `category_embeddings`를 target_language 1개로만 JOIN
- 변경: `ce_ko`, `ce_en`, `ce_zh` 3개 alias로 LEFT JOIN
- 각 언어별 `<=>` distance를 selectRaw로 추가
- `category_embedding_raw`는 target_language 기준 유지 (기존 동작 보존)

### RecommendResource

- `per_language_scores` 필드 추가:
  - 각 언어별 `similarity_score` (1 - distance)
  - `rank`: 페이지네이션 offset + 페이지 내 순위
- 기존 `similarity_score`, `query_embedding`, `category_embedding` 필드는 변경 없음

## 프론트엔드

### Recommendation 타입 (api.ts)

```typescript
interface LanguageScore {
  similarity_score: number | null;
  rank: number | null;
}

interface PerLanguageScores {
  ko: LanguageScore;
  en: LanguageScore;
  zh: LanguageScore;
}

// Recommendation에 추가
per_language_scores: PerLanguageScores | null;
```

### CosineDetailDialog

- 모달 하단에 `per_language_scores` 기반 3컬럼 레이아웃 추가
- `targetLanguage` prop 추가 (embed-page-inner에서 전달)
- 현재 언어 컬럼: `ring-2 ring-primary` + `shadow-md`로 강조
- 나머지 언어: muted 배경, 기본 border
- 각 컬럼: 언어명 → 점수%(bold, large) → 순위(small, muted)
- `per_language_scores`가 null이면 섹션 전체 숨김

## 테스트

- RecommendResourceTest: per_language_scores 구조 검증
- cosine-detail-dialog.test.tsx: 3컬럼 렌더링, 현재 언어 강조, null 케이스
