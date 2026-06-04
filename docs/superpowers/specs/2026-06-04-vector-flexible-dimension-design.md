# Design: 벡터 컬럼 차원 제한 해제

- **날짜:** 2026-06-04
- **상태:** Approved
- **범위:** `category_embeddings.embedding`, `search_logs.embedding` 컬럼 타입 변경

## 문제

`category_embeddings.embedding`과 `search_logs.embedding` 컬럼이 `vector(1024)`로 고정되어 있어,
1024 차원이 아닌 다른 임베딩 모델(예: OpenAI `text-embedding-3-small` 1536차원)을 사용할 수 없다.

Provider 추상화(Ollama/OpenAI)가 이미 완료되었으므로, DB 컬럼도 차원 유연성을 가져야 한다.

## 접근 방식

pgvector 0.5+에서 `vector` 타입은 차원 제한 없이 저장 가능하다.
`vector(1024)` → `vector`로 ALTER하면 차원 제약만 해제되고 기존 데이터에 영향이 없다.

### 안전성 근거

- **데이터 격리:** `embed_model_name`이 `(category_id, language, embed_model_name)` 복합키에 포함되어 있어, 서로 다른 모델의 벡터가 같은 행에 존재하지 않는다.
- **쿼리 호환:** `::vector` 캐스팅은 차원 무관하게 동작한다.
- **차원 불일치 방지:** 코사인 거리 연산(`<=>`)은 차원이 다르면 PostgreSQL 에러를 발생시킨다. 이는 `embed_model_name` 키로 자연스럽게 격리된다.

## 변경 범위

### 1. 마이그레이션 (신규)

`2026_06_04_000000_alter_embedding_columns_to_flexible_vector.php`

```php
DB::statement('ALTER TABLE category_embeddings ALTER COLUMN embedding TYPE vector');
DB::statement('ALTER TABLE search_logs ALTER COLUMN embedding TYPE vector');
```

### 2. Factory 수정

`CategoryEmbeddingFactory.php` — `randomUnitVector(1024)` 하드코딩 → 상수화

```php
private const DEFAULT_DIMENSIONS = 1024;

public function definition(): array
{
    return [
        // ...
        'embedding' => new Vector($this->randomUnitVector(self::DEFAULT_DIMENSIONS)),
    ];
}
```

### 3. Seeder 수정

`CategoryEmbeddingSeeder.php` — 동일 상수화

```php
private const DEFAULT_DIMENSIONS = 1024;
```

### 4. 문서 업데이트

- `docs/ADR.md` — ADR-001에 차원 유연성 언급 추가
- `docs/PRD.md` — 벡터 차원 관련 설명 업데이트

## 영향 분석

| 대상 | 영향 |
|---|---|
| 기존 데이터 | 없음 (제약 해제만, 데이터 변경 없음) |
| `CategoryEmbedding::scopeSimilarTo()` | 없음 (`::vector` 캐스팅은 차원 무관) |
| `RecommendationService::recommendPaginated()` | 없음 (동일) |
| `EmbeddingGenerator::generate()` | 없음 (반환 타입은 `float[]`, 차원 무관) |
| `CategoryController::runStep()` | 없음 (생성 시 차원은 provider가 결정) |

## 구현 순서

1. 마이그레이션 생성
2. Factory/Seeder 상수화
3. 문서 업데이트
4. 검증 (마이그레이션 실행 + 기존 테스트 통과)
