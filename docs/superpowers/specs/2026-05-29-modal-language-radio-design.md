# 유사도 모달 내 언어 라디오 버튼 전환 기능

## 개요

유사도 상세 모달(`CosineDetailDialog`) 하단의 "언어별 유사도" 섹션을 정적 표시에서 라디오 버튼 전환 방식으로 변경하여, 모달 내에서 언어를切换하면 SVG 시각화와 계산 과정이 해당 언어의 데이터로 갱신되도록 한다. 메인 리스트에는 영향을 주지 않는다.

## 현재 상태

- `cosine-detail-dialog.tsx` 274-336행: 3개 언어(ko/en/zh)를 카드 형태로 정적 표시
- 각 언어마다 `similarity_score`, `rank`만 표시
- SVG와 계산 과정은 `targetLanguage` prop으로 받은 1개 언어만 사용
- API(`RecommendResource`)는 `category_embedding`을 대상 언어 1개만 반환

## 변경 범위

### 1. 백엔드: `RecommendResource.php`

**파일**: `laravel/app/Http/Resources/RecommendResource.php`

- `per_language_scores` 객체에 각 언어별 `category_embedding` 추가
- 기존 `category_embedding` 필드는 유지 (하위 호환)

```php
// 변경 전
'per_language_scores' => $perLanguageScores,

// 변경 후
'per_language_scores' => [
    'ko' => ['similarity_score' => ..., 'rank' => ..., 'category_embedding' => ...],
    'en' => ['similarity_score' => ..., 'rank' => ..., 'category_embedding' => ...],
    'zh' => ['similarity_score' => ..., 'rank' => ..., 'category_embedding' => ...],
],
```

### 2. 프론트엔드: `api.ts` 타입 변경

**파일**: `nextjs/lib/api.ts`

```typescript
// 변경 전
export interface LanguageScore {
  similarity_score: number | null;
  rank: number | null;
}

// 변경 후
export interface LanguageScore {
  similarity_score: number | null;
  rank: number | null;
  category_embedding: number[] | null;
}
```

### 3. 프론트엔드: `cosine-detail-dialog.tsx` UI 변경

**파일**: `nextjs/components/admin/cosine-detail-dialog.tsx`

#### 3-1. 상태 추가
- `selectedLanguage: "ko" | "en" | "zh"` state 추가 (초기값: `targetLanguage`)

#### 3-2. 언어별 유사도 섹션 변경 (274-336행)
- 정적 카드 → 라디오 버튼 + 점수/순위 표시
- 라디오 버튼 클릭 시 `selectedLanguage` 변경
- 현재 선택된 언어 하이라이트 유지

#### 3-3. SVG 업데이트
- `VectorAngleSvg`에 `selectedLanguage` 기반 `similarity_score` 전달
- `per_language_scores[selectedLanguage].similarity_score` 사용

#### 3-4. 임베딩 미리보기 업데이트
- A(검색어): `query_embedding` (언어 무관, 동일)
- B(카테고리): `per_language_scores[selectedLanguage].category_embedding` 사용

#### 3-5. 계산 과정 업데이트
- 선택된 언어의 임베딩으로 dot product, norm 계산 표시

## 데이터 흐름

```
사용자 → 라디오 버튼 클릭
  → selectedLanguage 변경
  → per_language_scores[selectedLanguage]에서 데이터 추출
  → SVG, 임베딩 미리보기, 계산 과정 모두 갱신
  → 메인 리스트는 영향 없음 (별도 state)
```

## 영향 분석

- **메인 리스트**: 영향 없음 (모달 내부 state만 변경)
- **API 응답 크기**: 임베딩 1024차원 × 3 = 약 24KB 증가 (현재 1개분 대비)
- **기존 동작**: `targetLanguage` prop 유지로 하위 호환

## 테스트 시나리오

1. 모달 열기 → 기본 언어(targetLanguage)로 SVG/계산 표시 확인
2. 라디오 버튼으로 언어切换 → SVG 각도/점수 변경 확인
3. 라디오 버튼으로 언어切换 → B 임베딩 벡터 변경 확인
4. 라디오 버튼으로 언어切换 → 계산 과정 식 변경 확인
5. 모달 닫기 → 메인 리스트 영향 없는지 확인
6. 다른 결과 클릭 → 모달이 해당 결과의 언어 데이터로 표시 확인
