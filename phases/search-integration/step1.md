# Step 1: search-caching

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/PRD.md` (특히 §1.3 성능 지표: 캐시 히트 100ms 이하, 신규 1.5초 이하)
- `/docs/ARCHITECTURE.md` (특히 "상태 관리" — 비회원 session_id)
- `/docs/ADR.md`
- `/laravel/CLAUDE.md`
- `/laravel/app/Repositories/SearchLogRepository.php` (이전 step에서 생성됨)
- `/laravel/app/Models/SearchLog.php`
- `/laravel/app/Http/Controllers/Api/RecommendController.php` (이전 step에서 수정됨)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

검색 캐싱 로직을 완성하라. PRD §1.3에 따라 동일 키워드 재검색 시 100ms 이하 응답을 달성해야 한다.

### 검색어 정규화 (`app/Services/SearchNormalizer.php`)

검색어를 정규화하여 캐시 히트율을 높이는 서비스:
```php
class SearchNormalizer
{
    public function normalize(string $text): string;
    // - 앞뒤 공백 제거
    // - 연속 공백 → 단일 공백
    // - 소문자화 (영어)
}
```

### EmbeddingCacheService (`app/Services/EmbeddingCacheService.php`)

검색어 임베딩 캐싱을 관리:
```php
class EmbeddingCacheService
{
    public function __construct(
        private SearchLogRepository $repository,
        private EmbeddingGenerator $generator,
        private SearchNormalizer $normalizer,
    ) {}

    public function getOrCreateEmbedding(string $keyword, string $modelName, ?int $userId, string $sessionId): SearchLog;
}
```

핵심 규칙:
1. 키워드 정규화
2. 정규화된 키워드로 `search_logs` 테이블 조회 (user_id 또는 session_id 기준)
3. 히트 시: 기존 SearchLog 반환 (임베딩 재생성 없음 — 100ms 이하 달성)
4. 미스 시: `EmbeddingGenerator`로 새 임베딩 생성 → SearchLog 저장 → 반환
5. 성능 측정을 위해 `microtime(true)` 기반 로깅 추가

### RecommendController 수정

`EmbeddingCacheService`를 사용하도록 `recommend()` 메서드 리팩토링. `SearchLogRepository` 직접 호출 제거.

## 생성할 파일

- `laravel/app/Services/SearchNormalizer.php`
- `laravel/app/Services/EmbeddingCacheService.php`
- `laravel/app/Http/Controllers/Api/RecommendController.php` (수정)

## Acceptance Criteria

```bash
# 서비스 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  echo get_class(app(App\Services\EmbeddingCacheService::class));
  echo "\n";
  echo get_class(app(App\Services\SearchNormalizer::class));
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

- 정규화 시 한글을 소문자화하지 마라. 영어만 소문자화하라.
- 캐시 저장 시 원본 키워드와 정규화된 키워드를 모두 저장하라. 원본은 사용자 표시용, 정규화는 매칭용이다.
- 기존 테스트를 깨뜨리지 마라
