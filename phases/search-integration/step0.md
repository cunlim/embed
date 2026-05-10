# Step 0: pgvector-query

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` (ADR-001: pgvector)
- `/docs/PRD.md` (특히 §1.3 성능 지표, §3.2 검색 및 추천)
- `/laravel/CLAUDE.md`
- `/laravel/app/Http/Controllers/Api/RecommendController.php` (이전 task에서 생성됨)
- `/laravel/app/Models/CategoryEmbedding.php`
- `/laravel/app/Models/SearchLog.php`
- `/laravel/app/Services/EmbeddingGenerator.php`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

pgvector 코사인 유사도 쿼리를 최적화하고 `RecommendController`에 통합하라.

### CategoryEmbedding 모델에 Scope 추가

```php
public function scopeSimilarTo(Builder $query, array $vector, string $language, int $limit = 5): Builder
```

다음 Raw Query를 생성:
```sql
SELECT * FROM category_embeddings
WHERE language = :language
ORDER BY embedding <=> :query_vector
LIMIT :limit
```

`<=>` 연산자는 pgvector의 코사인 거리 연산자다. 유사도 점수는 `1.0 - distance`로 계산.

### SearchLogRepository (`app/Repositories/SearchLogRepository.php`)

검색 이력 조회를 전담하는 Repository. 이 클래스는 다음 step에서 `EmbeddingCacheService`가 내부적으로 사용한다.

```php
class SearchLogRepository
{
    public function findByNormalizedKeyword(string $normalizedKeyword, ?int $userId, string $sessionId): ?SearchLog;
    public function createSearchLog(array $data): SearchLog;
}
```

- `findByNormalizedKeyword()` — `normalized_keyword` 컬럼으로 조회. `user_id` 또는 `session_id` 기준으로 필터링.
- `createSearchLog()` — `search_keyword`(원본)과 `normalized_keyword`(정규화)를 모두 저장.

## 생성할 파일

- `laravel/app/Repositories/SearchLogRepository.php`
- `laravel/app/Models/CategoryEmbedding.php` (수정 — scopeSimilarTo 추가)

## Acceptance Criteria

```bash
# Scope 메서드 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  $v = array_fill(0, 1024, 0.0);
  echo get_class(App\Models\CategoryEmbedding::similarTo($v, "ko")->limit(5));
'

# Repository 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  echo get_class(app(App\Repositories\SearchLogRepository::class));
'

# PHP 코드 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent

# 전체 테스트 실행
docker exec cl_embed_laravel php artisan test --compact
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다.
3. 결과에 따라 `phases/search-integration/index.json`의 해당 step을 업데이트한다.

## 금지사항

- `<=>` 연산자 대신 `1 - (embedding <=> :vector)`로 유사도를 직접 계산하지 마라. `<=>` 자체가 코사인 거리이며, 유사도 = 1 - distance다.
- vector 파라미터를 문자열 연결로 SQL에 넣지 마라. 반드시 prepared statement(`:vector`)를 사용하라.
- `scopeSimilarTo`에서 `->toSql()`로 디버깅하지 마라. 완성된 구현을 하라.
- 기존 테스트를 깨뜨리지 마라
