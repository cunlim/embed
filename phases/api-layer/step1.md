# Step 1: recommend-controller

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (특히 "데이터 흐름")
- `/docs/PRD.md` (특히 §3.2 검색 및 추천 엔진)
- `/docs/ADR.md` (ADR-001: pgvector, ADR-003: nomic-embed-text)
- `/laravel/CLAUDE.md`
- `/laravel/app/Http/Controllers/Api/CategoryController.php` (이전 step에서 생성됨)
- `/laravel/app/Http/Resources/CategoryResource.php` (이전 step에서 생성됨)
- `/laravel/routes/api.php` (이전 step에서 생성됨 — 라우트 추가 필요)
- `/laravel/app/Services/EmbeddingGenerator.php` (이전 task에서 생성됨)
- `/laravel/app/Models/SearchLog.php` (이전 task에서 생성됨)
- `/laravel/app/Models/CategoryEmbedding.php`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

검색어를 받아 카테고리를 추천하는 RecommendController를 생성하라.

> **중요: 이 step에서 구현하는 추천 로직은 임시 구현이다.** `search-integration/step1`에서 `EmbeddingCacheService` + `scopeSimilarTo` 기반으로 완전히 교체된다. 여기서는 동작하는 기본 구현만 작성하고, 불필요한 최적화나 추상화를 하지 마라.

### RecommendController (`app/Http/Controllers/Api/RecommendController.php`)

시그니처:
```php
namespace App\Http\Controllers\Api;

class RecommendController extends Controller
{
    public function recommend(RecommendRequest $request): JsonResponse; // 5개 추천 결과 배열을 JSON으로 반환
}
```

핵심 규칙:
1. 요청: `{ "text": "검색어", "target_language": "ko" }`
2. `EmbeddingGenerator`로 검색어 임베딩 생성
3. `SearchLog`에 검색어 + 임베딩 + session_id 저장 (비회원은 session_id만)
4. `CategoryEmbedding`에서 target_language 기준으로 필터링
5. pgvector 코사인 유사도 Raw Query 실행 (실제 쿼리는 search-integration task에서 최적화, 여기서는 동작하는 기본 쿼리):
   ```sql
   SELECT category_id, embedding <=> :query_vector AS distance
   FROM category_embeddings
   WHERE language = :lang
   ORDER BY distance ASC
   LIMIT 5
   ```
6. 상위 5개 카테고리 반환

### RecommendRequest (`app/Http/Requests/RecommendRequest.php`)

- `text` — 필수, string, min:1, max:500
- `target_language` — 필수, string, in:ko,zh,en

### Recommend 라우트 등록 (`routes/api.php`)

`routes/api.php`에 다음 라우트를 추가하라:

```php
Route::post('recommend', [RecommendController::class, 'recommend']);
```

`bootstrap/app.php`에서 이미 `/api` prefix가 적용되므로, `routes/api.php` 내부에서는 prefix 없이 정의한다.

### RecommendResource (`app/Http/Resources/RecommendResource.php`)

각 추천 항목:
- `category_code`, `category_name` (target_language에 해당하는 이름), `similarity_score` (코사인 유사도)

## 생성할 파일

- `laravel/app/Http/Controllers/Api/RecommendController.php`
- `laravel/app/Http/Requests/RecommendRequest.php`
- `laravel/app/Http/Resources/RecommendResource.php`
- `laravel/routes/api.php` (수정 — recommend 라우트 추가)

## Acceptance Criteria

```bash
# 컨트롤러 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  echo get_class(app(App\Http\Controllers\Api\RecommendController::class));
'

# 라우트 등록 확인
docker exec cl_embed_laravel php artisan route:list --path=api

# PHP 코드 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent

# 전체 테스트 실행
docker exec cl_embed_laravel php artisan test --compact
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다.
3. 결과에 따라 `phases/api-layer/index.json`의 해당 step을 업데이트한다.

## 금지사항

- 추천 로직에서 N+1 쿼리가 발생하지 않도록 주의하라. `CategoryEmbedding` 쿼리 시 `with('category')`를 사용하라.
- pgvector 쿼리는 `DB::select()`로 Raw SQL을 사용하라. Eloquent Builder에는 vector 연산자가 없다.
- 기존 테스트를 깨뜨리지 마라
