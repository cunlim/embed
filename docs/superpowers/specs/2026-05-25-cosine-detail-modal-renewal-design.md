# 코사인 유사도 상세 모달 리뉴얼 설계

## 개요

embed 페이지 유사도 검색 결과 테이블에서 퍼센트 링크 클릭 시 열리는 "코사인 유사도 상세" 모달을 리뉴얼한다. 임베딩 벡터, 각도 시각화, 계산식을 포함하도록 개선하고 기존의 추상적 "처리 과정" 설명은 제거한다.

## 현재 상태

- `CosineDetailDialog` (`components/admin/cosine-detail-dialog.tsx`) — 카테고리명, 유사도 점수 퍼센트, 5단계 처리 과정 설명 표시
- `Recommendation` 타입 (`lib/api.ts`) — `similarity_score`만 포함, 임베딩 벡터 데이터 없음
- `RecommendResource` (`laravel/app/Http/Resources/RecommendResource.php`) — `similarity_score`만 응답에 포함
- `RecommendationService::recommendPaginated()` — pgvector `<=>` 연산자로 코사인 거리 계산, `similarity_score = 1 - distance`

## 목표

1. 유사도 점수와 두 임베딩 벡터를 직접 보여주는 데이터 중심 모달
2. 벡터 각도를 SVG로 시각화
3. 임베딩 벡터 전체 복사 (JSON), 계산식 복사 (Windows 계산기 호환)
4. 기존 5단계 처리 과정 설명 제거

## API 변경

### `GET /api/recommend` 응답 확장

`RecommendResource`에 다음 필드를 추가한다:

```json
{
  "data": [
    {
      "id": 1,
      "category_code": "ELEC-COMP-NOTE",
      "category_name": "...",
      "similarity_score": 0.873,
      "query_embedding": [-0.023, 0.145, ...],
      "category_embedding": [-0.018, 0.152, ...]
    }
  ]
}
```

- `query_embedding`: 검색어의 bge-m3 임베딩 벡터 (float[], 1024차원). 모든 결과 행에 동일한 값이 중복 포함된다. 응답 크기 증가는 항목당 약 16KB.
- `category_embedding`: 해당 카테고리의 임베딩 벡터 (float[], 1024차원). `SearchLog.embedding`과 `CategoryEmbedding.embedding`에서 가져온다.

### 백엔드 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `RecommendController.php` | `$searchLog->embedding`과 각 결과의 category_embedding을 Resource에 전달 |
| `RecommendResource.php` | `query_embedding`, `category_embedding` 필드 추가 |
| `RecommendationService.php` | `recommendPaginated()`에서 category_embedding도 함께 반환하도록 JOIN/select 수정 |

### 프론트엔드 타입 변경

`lib/api.ts`의 `Recommendation` 인터페이스에 `query_embedding: number[]`, `category_embedding: number[]` 추가.

## 모달 레이아웃

```
┌─ 코사인 유사도 상세 ──────────────────────┐
│                                             │
│            유사도 점수                       │
│    [벡터 각도 SVG]  87.3%                   │
│    A(파랑) B(빨강)  cos θ = 0.873, θ=29.2° │
│                                             │
│  ──────────────────────────────────────     │
│  A. 검색어 임베딩  [컴퓨터]                 │
│  ┌──────────────────────────────────┐       │
│  │ [-0.023, 0.145, ... 1024차원]  [복사] │  │
│  └──────────────────────────────────┘       │
│                                             │
│  B. 카테고리 임베딩  [전자제품>컴퓨터>노트북] │
│  ┌──────────────────────────────────┐       │
│  │ [-0.018, 0.152, ... 1024차원]  [복사] │  │
│  └──────────────────────────────────┘       │
│                                             │
│  ──────────────────────────────────────     │
│  계산 과정                                  │
│  ┌──────────────────────────────────────┐   │
│  │ cos(θ)=(A·B)/(|A|×|B|)=((-0.023×... [복사] │
│  └──────────────────────────────────────┘   │
│  ※ 복사 시 전체 1024항 dot product 식       │
└─────────────────────────────────────────────┘
```

## 컴포넌트 상세

### 벡터 각도 SVG

- A(검색어)는 3시 방향(0°), B(카테고리)는 반시계 방향으로 벌어짐
- 각도 θ = arccos(similarity_score), 호와 각도 값(°) 표시
- x, y 축 표시
- 색상: A(파랑), B(빨강), 각도 호(인디고)

### 임베딩 행

- 라벨: "A. 검색어 임베딩" / "B. 카테고리 임베딩"
- 검색어/카테고리명은 inline badge로 표시 (A는 파랑 계열, B는 분홍 계열)
- 벡터 미리보기: 앞 6개 값 + "... 1024차원" (한 줄, overflow ellipsis)
- 복사 버튼: 전체 1024차원 JSON 배열을 클립보드에 복사

### 계산식 행

- 표시: `cos(θ) = (A·B) / (|A|×|B|) = ({첫 1항} + ...) / (1×1) = {score}`
- bge-m3 임베딩은 정규화된 단위 벡터이므로 |A| = |B| = 1
- 복사 버튼: 전체 1024항 dot product 전개식을 클립보드에 복사
- 복사 형식: `((-0.023*-0.018)+(0.145*0.152)+(-0.089*-0.076)+...)` — Windows 계산기에 붙여넣어 동일 결과 확인 가능

### 처리 과정

제거한다. 임베딩 값과 계산식이 직접 표시되므로 별도 설명 불필요.

## 구현 범위

### Backend (Laravel)
1. `RecommendationService::recommendPaginated()` — category_embedding 벡터를 결과에 포함
2. `RecommendController::recommend()` — query_embedding을 Resource 생성자에 전달
3. `RecommendResource` — `query_embedding`, `category_embedding` 필드 추가
4. 테스트: RecommendControllerTest, RecommendResourceTest 갱신

### Frontend (Next.js)
1. `lib/api.ts` — `Recommendation` 타입에 `query_embedding`, `category_embedding` 추가
2. `components/admin/cosine-detail-dialog.tsx` — 전체 리뉴얼
3. `app/embed/embed-page-inner.tsx` — 모달에 result prop 그대로 전달 (변경 최소화)
4. 테스트: cosine-detail-dialog 테스트 추가

## 복사 기능 명세

| 항목 | 표시 내용 | 복사 내용 |
|------|----------|----------|
| 임베딩 A/B | 앞 6개 값 + "... 1024차원" | 전체 1024차원 JSON 배열 `[...]` |
| 계산식 | 수식 + 1개항 + 결과 | 전체 1024항 전개식 `((-a*-b)+(c*d)+...)` |
