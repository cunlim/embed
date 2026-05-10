# Step 3: rate-limiter

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (특히 "데이터 흐름" §4: Rate Limit 방어)
- `/docs/ADR.md` (ADR-003: Rate Limit 언급)
- `/docs/PRD.md` (특히 §1.3 안정성 지표)
- `/laravel/CLAUDE.md`
- `/laravel/config/cache.php` (Redis 캐시 설정 확인)
- `/laravel/app/Services/OllamaClient.php` (이전 step에서 생성됨)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

Ollama API 호출에 Rate Limit을 적용하라. ARCHITECTURE.md 데이터 흐름 §4에 명시된 대로, 동시에 너무 많은 Ollama 요청이 발생하지 않도록 제한한다.

### OllamaRateLimiter (`app/Services/OllamaRateLimiter.php`)

```php
namespace App\Services;

class OllamaRateLimiter
{
    public function __construct(private int $maxAttempts = 10, private int $decaySeconds = 60) {}

    public function attempt(string $key = 'ollama'): bool;
    public function tooManyAttempts(string $key = 'ollama'): bool;
    public function availableIn(string $key = 'ollama'): int; // seconds
}
```

핵심 규칙:
- Laravel `Redis::throttle()` 파사드를 사용하여 분당 최대 10회로 제한
- `tooManyAttempts()`가 true면 예외를 throw하지 않고 false를 반환 (호출자가 판단)
- `availableIn()`은 다음 요청 가능 시점까지 남은 초를 반환

### OllamaClient 수정

`OllamaClient`의 `chat()`과 `embed()` 메서드에서 요청 전 `OllamaRateLimiter`를 체크하도록 수정:

```php
// 생성자에 추가
public function __construct(
    private OllamaRateLimiter $rateLimiter,
    private string $baseUrl,
    private int $timeout = 300,
) {}
```

```php
// chat(), embed() 시작 부분에 추가
if ($this->rateLimiter->tooManyAttempts()) {
    $availableIn = $this->rateLimiter->availableIn();
    throw new \RuntimeException("Ollama rate limit exceeded. Available in {$availableIn}s");
}
$this->rateLimiter->attempt();
```

## 생성할 파일

- `laravel/app/Services/OllamaRateLimiter.php`
- `laravel/app/Services/OllamaClient.php` (수정 — Rate Limiter 체크 추가)

> **참고**: `TranslateAndEmbedJob`의 Rate Limit 예외 처리는 `translation-pipeline/step0`에서 Job 생성 시 함께 구현한다.

## Acceptance Criteria

```bash
# Rate Limiter 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  $r = new App\Services\OllamaRateLimiter(10, 60);
  echo $r->tooManyAttempts() ? "blocked" : "allowed";
'

# OllamaClient에 Rate Limiter 주입 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  echo get_class(app(App\Services\OllamaClient::class));
'

# PHP 코드 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent

# 전체 테스트 실행
docker exec cl_embed_laravel php artisan test --compact
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md §4 Rate Limit 방어 요구사항을 충족하는가?
   - ADR-003의 Rate Limit 언급을 준수하는가?
3. 결과에 따라 `phases/ollama-integration/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `Redis::throttle()` 대신 단순 `sleep()`을 사용하지 마라. 이유: 분산 환경에서 정확한 제한을 위해 Redis 기반 throttle이 필요하다.
- Rate Limit 초과 시 예외를 삼키지 마라. 호출자에게 전파하여 적절한 재시도가 이루어지게 하라.
- 기존 테스트를 깨뜨리지 마라
