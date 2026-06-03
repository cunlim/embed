# 임베딩/번역 프로바이더 추상화 설계

## 개요

현재 `ollama` 키워드로 고정된 임베딩/번역 호출을 `embed` + `translate`로 분리하고, 다중 프로바이더(Ollama, LM Studio, Remote API)를 지원하도록 추상화한다. API 키 설정을 추가하여 인증이 필요한 프로바이더도 대응한다.

## 배경

- 현재 DB `settings` 테이블에 `group="ollama"`로 7개 설정 저장
- `OllamaClient`가 `/api/embed`, `/api/chat` 형식으로 고정 HTTP 호출
- API 키 지원 없음 (Ollama은 인증 불요)
- 번역과 임베딩이 동일 `OllamaClient` 공유

### 필요성

- LM Studio, Remote API 등 OpenAI 호환 프로바이더 지원 필요
- 프로바이더별 API 형식 차이 (Ollama vs OpenAI 호환)
- API 키 인증 지원 필요

## 결정 사항

| 항목 | 결정 | 이유 |
|------|------|------|
| 변경 범위 | 임베딩 + 번역 모두 | 일관성 있는 추상화 |
| API 형식 | Ollama + OpenAI 호환 | 대부분 프로바이더가 OpenAI 호환 지원 |
| 설정 구조 | `embed` + `translate` 분리 | 프로바이더를 다르게 설정 가능 |
| 프로바이더 감지 | URL 기반 자동 감지 | 설정 단순화 |
| 아키텍처 | 전략 패턴 (Strategy Pattern) | 클린한 분리, 확장성 |

## DB 설정 구조

### embed 그룹 (임베딩 설정)

| Key | 기본값 | 타입 | 설명 |
|-----|--------|------|------|
| `host` | `http://host.docker.internal:11434` | string | API 서버 주소 |
| `api_key` | `` (빈 문자열) | string | API 키 (Ollama은 불필요) |
| `model` | `bge-m3:latest` | string | 임베딩 모델명 |
| `timeout` | `300` | integer | HTTP 타임아웃(초) |
| `rate_limit_max_attempts` | `60` | integer | Rate Limit 최대 시도 |
| `rate_limit_decay_seconds` | `60` | integer | Rate Limit 시간 창(초) |

### translate 그룹 (번역 설정)

| Key | 기본값 | 타입 | 설명 |
|-----|--------|------|------|
| `host` | `http://host.docker.internal:11434` | string | API 서버 주소 |
| `api_key` | `` (빈 문자열) | string | API 키 |
| `model` | `translategemma:4b` | string | 번역 모델명 |
| `timeout` | `300` | integer | HTTP 타임아웃(초) |
| `max_attempts` | `3` | integer | 환각 재시도 횟수 |

### 변경 점

- `ollama` 그룹 폐지 → `embed` + `translate`로 마이그레이션
- `api_key` 필드 신규 추가
- `http_max_attempts`(재시도 횟수)는 코드 하드코딩 유지 (3회)

## 백엔드 아키텍처

### 인터페이스

```php
// app/Services/Contracts/EmbeddingProviderInterface.php
interface EmbeddingProviderInterface
{
    /** 텍스트를 벡터로 변환 */
    public function embed(string $model, string $text): array;
}

// app/Services/Contracts/TranslationProviderInterface.php
interface TranslationProviderInterface
{
    /** 텍스트를 번역 */
    public function chat(string $model, string $prompt, array $options = []): string;
}
```

### 디렉토리 구조

```
app/Services/
├── Contracts/
│   ├── EmbeddingProviderInterface.php
│   └── TranslationProviderInterface.php
├── Providers/
│   ├── OllamaEmbeddingProvider.php      ← 기존 OllamaClient::embed() 이동
│   ├── OllamaTranslationProvider.php    ← 기존 OllamaClient::chat() 이동
│   ├── OpenAIEmbeddingProvider.php      ← 신규 (POST /v1/embeddings)
│   └── OpenAITranslationProvider.php    ← 신규 (POST /v1/chat/completions)
├── ProviderDetector.php                 ← URL 기반 프로바이더 타입 감지
├── ProviderFactory.php                  ← 프로바이더 인스턴스 생성
├── EmbeddingRateLimiter.php             ← 기존 OllamaRateLimiter에서 분리
├── TranslationRateLimiter.php           ← 기존 OllamaRateLimiter에서 분리
├── EmbeddingGenerator.php               ← 수정 (인터페이스 주입)
└── Translator.php                       ← 기존 OllamaTranslator에서 변경
```

### ProviderDetector 로직

```php
class ProviderDetector
{
    public function detect(string $url): string
    {
        // Ollama: 포트 11434 또는 /api/embed 패턴
        if (str_contains($url, ':11434') || str_contains($url, '/api/embed')) {
            return 'ollama';
        }
        // 기본: OpenAI 호환
        return 'openai';
    }
}
```

### ProviderFactory

```php
class ProviderFactory
{
    public function createEmbeddingProvider(): EmbeddingProviderInterface
    {
        $host = config('services.embed.host');
        $apiKey = config('services.embed.api_key');
        $timeout = config('services.embed.timeout', 300);
        $type = (new ProviderDetector)->detect($host);

        return match ($type) {
            'ollama' => new OllamaEmbeddingProvider($host, $timeout, $rateLimiter),
            'openai' => new OpenAIEmbeddingProvider($host, $apiKey, $timeout, $rateLimiter),
        };
    }

    public function createTranslationProvider(): TranslationProviderInterface
    {
        $host = config('services.translate.host');
        $apiKey = config('services.translate.api_key');
        $timeout = config('services.translate.timeout', 300);
        $type = (new ProviderDetector)->detect($host);

        return match ($type) {
            'ollama' => new OllamaTranslationProvider($host, $timeout, $rateLimiter),
            'openai' => new OpenAITranslationProvider($host, $apiKey, $timeout, $rateLimiter),
        };
    }
}
```

### 재시도 및 Rate Limiting

기존 `OllamaClient`의 핵심 로직은 새 프로바이더 구현체에 보존한다:

- **retryCall()**: 지수 백오프 + 지터, 429/5xx 재시도, 최대 3회
- **checkRateLimit()**: `OllamaRateLimiter`를 통한 Rate Limit 검사
- 프로바이더 구현체 내부에 동일 로직 포함 (중복 허용, 프로바이더별 재시도 전략 다를 수 있음)

### Rate Limiter 구조

- `OllamaRateLimiter`를 `EmbeddingRateLimiter` + `TranslationRateLimiter`로 분리
- 임베딩과 번역은 독립적인 Rate Limit 적용 (서로 다른 서비스이므로)
- 각 프로바이더 구현체에 해당 RateLimiter 주입

### ProviderDetector 엣지 케이스

- Ollama를 비표준 포트(11434 외)로 실행 시: `/api/embed` 패턴으로 감지 시도
- 감지 실패 시 기본값: OpenAI 호환 (대부분의 프로바이더가 지원)
- 필요 시 향후 `provider_type` 설정 키를 추가하여 수동 오버라이드 가능

### EmbeddingGenerator 변경

```php
class EmbeddingGenerator
{
    public function __construct(
        private EmbeddingProviderInterface $provider,
    ) {}

    public function generate(string $text): array
    {
        $model = config('services.embed.model', 'bge-m3:latest');
        return $this->provider->embed($model, $text);
    }
}
```

### Translator 변경 (기존 OllamaTranslator)

```php
class Translator
{
    public function __construct(
        private TranslationProviderInterface $provider,
    ) {}

    // 기존 translate(), translateSingle(), buildPrompt(), isValidTranslation() 유지
    // config 참조: 'services.ollama.*' → 'services.translate.*'
}
```

### AppServiceProvider 변경

```php
// register()
$this->app->bind(EmbeddingProviderInterface::class, function ($app) {
    return $app->make(ProviderFactory::class)->createEmbeddingProvider();
});

$this->app->bind(TranslationProviderInterface::class, function ($app) {
    return $app->make(ProviderFactory::class)->createTranslationProvider();
});

// boot() - 설정 로드
config([
    'services.embed.host' => $settings->get('embed', 'host', config('services.embed.host')),
    'services.embed.api_key' => $settings->get('embed', 'api_key', ''),
    'services.embed.model' => $settings->get('embed', 'model', 'bge-m3:latest'),
    'services.embed.timeout' => $settings->get('embed', 'timeout', 300),
    'services.embed.rate_limit_max_attempts' => $settings->get('embed', 'rate_limit_max_attempts', 60),
    'services.embed.rate_limit_decay_seconds' => $settings->get('embed', 'rate_limit_decay_seconds', 60),
    'services.translate.host' => $settings->get('translate', 'host', config('services.translate.host')),
    'services.translate.api_key' => $settings->get('translate', 'api_key', ''),
    'services.translate.model' => $settings->get('translate', 'model', 'translategemma:4b'),
    'services.translate.timeout' => $settings->get('translate', 'timeout', 300),
    'services.translate.max_attempts' => $settings->get('translate', 'max_attempts', 3),
]);
```

### config/services.php 변경

```php
// 'ollama' 섹션 제거, 다음으로 교체
'embed' => [
    'host' => env('EMBED_HOST', 'http://host.docker.internal:11434'),
    'api_key' => env('EMBED_API_KEY', ''),
    'model' => 'bge-m3:latest',
    'timeout' => 300,
    'rate_limit_max_attempts' => 60,
    'rate_limit_decay_seconds' => 60,
],
'translate' => [
    'host' => env('TRANSLATE_HOST', 'http://host.docker.internal:11434'),
    'api_key' => env('TRANSLATE_API_KEY', ''),
    'model' => 'translategemma:4b',
    'timeout' => 300,
    'max_attempts' => 3,
],
```

## 프론트엔드 변경

### settings-panel.tsx

**그룹 라벨:**
```typescript
const GROUP_LABELS: Record<string, string> = {
  embed: "임베딩",
  translate: "번역",
  // ... (기존 그룹 유지)
};
```

**필드 라벨:**
```typescript
const FIELD_LABELS: Record<string, Record<string, string>> = {
  embed: {
    host: "API 서버 주소",
    api_key: "API 키",
    model: "임베딩 모델명",
    timeout: "HTTP 타임아웃(초)",
    rate_limit_max_attempts: "Rate Limit 최대 시도",
    rate_limit_decay_seconds: "Rate Limit 시간 창(초)",
  },
  translate: {
    host: "API 서버 주소",
    api_key: "API 키",
    model: "번역 모델명",
    timeout: "HTTP 타임아웃(초)",
    max_attempts: "번역 재시도 횟수",
  },
  // ... (기존 그룹 유지)
};
```

**API 키 필드:**
- `api_key` 필드는 `type="password"`로 표시
- 빈 문자열 저장 가능 (Ollama 등 인증 불요 시)

### AdminSettingsController

`GROUPS` 상수에서 `'ollama'` 제거, `'embed'`, `'translate'` 추가.

## 마이그레이션

### DB 마이그레이션

기존 `ollama` 그룹 설정을 `embed` + `translate`로 마이그레이션:

```
ollama.host → embed.host, translate.host
ollama.embedding_model → embed.model
ollama.translation_model → translate.model
ollama.timeout → embed.timeout, translate.timeout
ollama.translation_max_attempts → translate.max_attempts
ollama.rate_limit_max_attempts → embed.rate_limit_max_attempts
ollama.rate_limit_decay_seconds → embed.rate_limit_decay_seconds
```

마이그레이션 후 `ollama` 그룹 삭제.

### .env 변경

```
OLLAMA_HOST → EMBED_HOST, TRANSLATE_HOST
신규: EMBED_API_KEY, TRANSLATE_API_KEY
```

## 영향 받는 파일

### 백엔드 (신규)

- `app/Services/Contracts/EmbeddingProviderInterface.php`
- `app/Services/Contracts/TranslationProviderInterface.php`
- `app/Services/Providers/OllamaEmbeddingProvider.php`
- `app/Services/Providers/OllamaTranslationProvider.php`
- `app/Services/Providers/OpenAIEmbeddingProvider.php`
- `app/Services/Providers/OpenAITranslationProvider.php`
- `app/Services/ProviderDetector.php`
- `app/Services/ProviderFactory.php`
- `app/Services/EmbeddingRateLimiter.php` (기존 OllamaRateLimiter에서 분리)
- `app/Services/TranslationRateLimiter.php` (기존 OllamaRateLimiter에서 분리)
- `database/migrations/2026_06_03_migrate_ollama_to_embed_translate.php`

### 백엔드 (수정)

- `config/services.php`
- `app/Providers/AppServiceProvider.php`
- `app/Services/EmbeddingGenerator.php`
- `app/Services/OllamaTranslator.php` → `app/Services/Translator.php`
- `app/Services/OllamaClient.php` → 폐지 (분리)
- `app/Services/OllamaRateLimiter.php` → 폐지 (분리)
- `database/seeders/SettingsSeeder.php`
- `app/Http/Controllers/Api/AdminSettingsController.php`
- `app/Http/Controllers/Api/CategoryController.php` (config 참조 변경)
- `app/Http/Controllers/Api/RecommendController.php` (config 참조 변경)
- 테스트 파일 다수

### 프론트엔드 (수정)

- `nextjs/components/admin/settings-panel.tsx`
- `nextjs/components/admin/task-execution.tsx` (ollama 참조 확인)

### 문서 (수정)

- `docs/ADR.md` - ADR-003 업데이트
- `docs/PRD.md` - 임베딩 관련 업데이트
- `docs/UI_GUIDE.md` - 설정 패널 업데이트

## OpenAI 호환 API 형식

### 임베딩 (POST /v1/embeddings)

```json
// 요청
{
  "model": "text-embedding-3-small",
  "input": "임베딩할 텍스트"
}

// 응답
{
  "data": [
    {
      "embedding": [0.1, 0.2, ...],
      "index": 0
    }
  ]
}
```

### 번역 (POST /v1/chat/completions)

```json
// 요청
{
  "model": "gpt-4",
  "messages": [
    {"role": "user", "content": "Translate to English: 안녕하세요"}
  ],
  "stream": false
}

// 응답
{
  "choices": [
    {
      "message": {
        "content": "Hello"
      }
    }
  ]
}
```
