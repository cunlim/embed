# Step 0: ollama-client

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` (특히 ADR-003: Ollama 로컬 모델 관련 결정)
- `/laravel/CLAUDE.md`
- `/laravel/config/services.php` (외부 서비스 설정 패턴 확인)
- `/laravel/config/cache.php` (Redis 캐시 설정 확인)
- `/laravel/app/Providers/AppServiceProvider.php`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

### 1. Settings 마이그레이션 & 모델

앱 설정을 DB에 저장하기 위한 인프라를 구축한다. Ollama 설정 3건이 첫 사용 사례다.

**마이그레이션**: `database/migrations/____create_settings_table.php`
- 컬럼: `id`, `group`(string 50), `key`(string 100), `value`(text), `type`(string 20, 기본값 `'string'`), `description`(string 255 nullable), `timestamps`
- unique(`group`, `key`)

**Setting 모델** (`app/Models/Setting.php`):
```php
namespace App\Models;

#[Fillable(['group', 'key', 'value', 'type', 'description'])]
class Setting extends Model
{
    // casts(): id => integer
}
```

### 2. SettingsService (`app/Services/SettingsService.php`)

DB 기반 설정을 읽고 쓰는 서비스. Laravel Cache 파사드로 캐싱하여 매 요청마다 DB 쿼리를 방지한다.

```php
namespace App\Services;

class SettingsService
{
    public function get(string $group, string $key, mixed $default = null): mixed;
    public function all(string $group): array;
}
```

핵심 규칙:
- `get()`: 캐시 키 `"settings:{$group}:{$key}"` 로 먼저 조회. 없으면 DB 조회 후 캐시 저장. 캐시 TTL 3600초(1시간).
- `all()`: 해당 그룹의 모든 설정을 연관 배열 `['key' => 'value', ...]`로 반환. 개별 캐시 키를 먼저 조회하고, 누락된 키만 DB에서 일괄 조회.
- DB에 값이 없으면 `$default`를 반환한다.
- `type` 컬럼에 따라 `value`를 캐스팅한다: `integer` → `(int)`, 그 외 → string 그대로. (추후 `encrypted` 타입 확장 가능)
- Cache 파사드의 store는 `redis`를 사용한다 (`CACHE_STORE=redis`로 운영되므로 `cache()->driver()` 기본값 사용).

### 3. `config/services.php`에 ollama 섹션 추가

```php
'ollama' => [
    'host' => 'http://host.docker.internal:11434',
    'translation_model' => 'translategemma:4b',
    'embedding_model' => 'bge-m3:latest',
],
```

이 값들은 DB에 설정이 없을 때의 fallback 기본값으로 사용된다.

### 4. `AppServiceProvider` 수정

`boot()` 메서드에서 `SettingsService`로 ollama 설정을 읽어 `config()`를 오버라이드한다:

```php
$settings = app(SettingsService::class);
config([
    'services.ollama.host' => $settings->get('ollama', 'host', config('services.ollama.host')),
    'services.ollama.translation_model' => $settings->get('ollama', 'translation_model', config('services.ollama.translation_model')),
    'services.ollama.embedding_model' => $settings->get('ollama', 'embedding_model', config('services.ollama.embedding_model')),
]);
```

### 5. SettingsSeeder (`database/seeders/SettingsSeeder.php`)

ollama 그룹 3개 설정의 초기값을 `firstOrCreate`로 삽입한다:

| group | key | value | type | description |
|-------|-----|-------|------|-------------|
| ollama | host | `http://host.docker.internal:11434` | string | Ollama API 서버 주소 |
| ollama | translation_model | `translategemma:4b` | string | 번역에 사용할 Ollama 모델명 |
| ollama | embedding_model | `bge-m3:latest` | string | 임베딩에 사용할 Ollama 모델명 |

`DatabaseSeeder`의 call 배열에 `SettingsSeeder::class`를 추가한다.

### 6. OllamaClient (`app/Services/OllamaClient.php`)

Ollama의 REST API를 호출하는 HTTP 클라이언트 래퍼.

```php
namespace App\Services;

class OllamaClient
{
    public function __construct(
        private string $baseUrl,   // config('services.ollama.host')
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
- HTTP Client는 Laravel의 `Illuminate\Support\Facades\Http` 파사드를 사용한다.

### 7. `.env` 정리

Ollama 3개 변수를 `.env`에서 제거한다 (`OLLAMA_API_BASE_URL`, `OLLAMA_EMBED_MODEL`, `OLLAMA_TRANSLATE_MODEL`). 기본값은 `config/services.php`에 있고, 운영값은 DB settings 테이블에서 관리한다.

## 생성할 파일

- `laravel/database/migrations/____create_settings_table.php`
- `laravel/app/Models/Setting.php`
- `laravel/app/Services/SettingsService.php`
- `laravel/app/Services/OllamaClient.php`
- `laravel/database/seeders/SettingsSeeder.php`

## 수정할 파일

- `laravel/config/services.php` — ollama 섹션 추가
- `laravel/app/Providers/AppServiceProvider.php` — boot()에서 config 오버라이드
- `laravel/database/seeders/DatabaseSeeder.php` — SettingsSeeder 호출 추가
- `laravel/.env` — Ollama 변수 3개 제거

## Acceptance Criteria

```bash
# SettingsService 동작 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  $s = app(App\Services\SettingsService::class);
  echo $s->get("ollama", "host") . "\n";
  echo json_encode($s->all("ollama"));
'

# OllamaClient 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  $c = app(App\Services\OllamaClient::class);
  echo get_class($c);
'

# config 오버라이드 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  echo config("services.ollama.host") . "\n";
  echo config("services.ollama.translation_model") . "\n";
  echo config("services.ollama.embedding_model");
'

# PHP 코드 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent

# 전체 테스트 실행
docker exec cl_embed_laravel php artisan test --compact
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR 기술 스택을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가? (모든 문서·주석은 한국어, 코드 식별자는 영어)
3. 결과에 따라 `phases/ollama-integration/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `.env`에서 OAuth 설정(GOOGLE_*, GITHUB_*, NAVER_*)을 제거하지 마라. Ollama 3개 변수만 제거 대상이다.
- `Setting` 모델에서 `value`를 `encrypted`로 cast하지 마라. 현재 3개 값은 모두 평문이며, 추후 `type='encrypted'` 인 경우에만 암복호화하도록 `SettingsService`에서 처리할 확장 포인트만 남겨둔다.
- 실제 Ollama 호출 테스트를 하지 마라. 클라이언트 클래스 생성 및 DI 설정만 수행한다. 이유: Ollama가 실행 중이 아닐 수 있음.
- HTTP Client는 Laravel의 `Illuminate\Support\Facades\Http` 파사드를 사용하라. Guzzle을 직접 호출하지 마라.
- 기존 테스트를 깨뜨리지 마라

> **경고**: `step3`에서 `OllamaRateLimiter`를 생성자 **첫 번째 파라미터**로 추가하여 시그니처가 변경된다 (`__construct(OllamaRateLimiter, string, int)`). 이 step에서는 `OllamaRateLimiter` 없이 2-param 생성자로 구현하고, step3에서 생성자와 `chat()`/`embed()` 메서드를 수정한다. `OllamaClient`를 `new` 키워드로 직접 인스턴스화하는 코드가 있다면 step3에서 함께 수정해야 한다.
