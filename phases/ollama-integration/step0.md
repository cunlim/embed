# Step 0: ollama-client

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` (특히 ADR-003: Ollama 로컬 모델 관련 결정)
- `/laravel/CLAUDE.md`
- `/laravel/.env` (Ollama 호스트/포트 설정 확인)
- `/laravel/config/services.php` (외부 서비스 설정 패턴 확인)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

Ollama HTTP API와 통신하는 클라이언트 클래스를 생성하라.

### OllamaClient (`app/Services/OllamaClient.php`)

Ollama의 REST API를 호출하는 HTTP 클라이언트 래퍼.

시그니처:
```php
namespace App\Services;

class OllamaClient
{
    public function __construct(
        private string $baseUrl,   // 기본값: env('OLLAMA_HOST', 'http://host.docker.internal:11434')
                                    // WSL2 networkingMode=mirrored 환경에서 정상 동작
        private int $timeout = 300
    ) {}

    public function chat(string $model, string $prompt, array $options = []): string;
    public function embed(string $model, string $text): array; // float[]
}
```

핵심 규칙:
- `chat()`은 Ollama `/api/chat` 엔드포인트를 호출한다. `stream: false`로 설정하여 전체 응답을 한 번에 받는다.
- `embed()`는 Ollama `/api/embed` 엔드포인트를 호출한다.
- 두 메서드 모두 HTTP 요청 실패 시 `HttpException`을 throw한다 (timeout, connection refused 등).
- `chat()`의 `$options`는 Ollama API의 `options` 필드에 그대로 전달한다 (temperature 등).
- 응답 파싱 실패 시 `\RuntimeException`을 throw한다.

### Config

`config/services.php`에 ollama 설정을 추가하라:
```php
'ollama' => [
    'host' => env('OLLAMA_HOST', 'http://host.docker.internal:11434'),
    'translation_model' => env('OLLAMA_TRANSLATION_MODEL', 'translategemma:4b'),
    'embedding_model' => env('OLLAMA_EMBEDDING_MODEL', 'bge-m3:latest'),
],
```

`.env`에 각 모델 환경변수를 추가하라 (기본값 명시).

## 생성할 파일

- `laravel/app/Services/OllamaClient.php`
- `laravel/config/services.php` (수정 — ollama 섹션 추가)
- `laravel/.env` (OLLAMA_HOST 주석 추가, 기본값 명시)

## Acceptance Criteria

```bash
# 서비스가 올바르게 바인딩되는지 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  $c = new App\Services\OllamaClient("http://host.docker.internal:11434");
  echo get_class($c);
'

# PHP 코드 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent

# 전체 테스트 실행
docker exec cl_embed_laravel php artisan test --compact
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다.
3. 결과에 따라 `phases/ollama-integration/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 이 step에서는 실제 Ollama 호출 테스트를 하지 마라. 클라이언트 클래스 생성 및 DI 설정만 수행한다. 이유: Ollama가 실행 중이 아닐 수 있음.
- HTTP Client는 Laravel의 `Illuminate\Support\Facades\Http` 파사드를 사용하라. Guzzle을 직접 호출하지 마라.
- 기존 테스트를 깨뜨리지 마라

> **참고**: `step3`에서 `OllamaRateLimiter`를 생성자에 추가하여 시그니처가 변경된다. 이 step에서는 `OllamaRateLimiter` 없이 구현하고, step3에서 수정한다.
