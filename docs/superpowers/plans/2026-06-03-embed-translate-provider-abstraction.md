# 임베딩/번역 프로바이더 추상화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ollama` 키워드를 `embed` + `translate`로 분리하고, Ollama/OpenAI 호환 다중 프로바이더를 전략 패턴으로 지원한다.

**Architecture:** `EmbeddingProviderInterface`와 `TranslationProviderInterface`를 정의하고, `ProviderDetector`가 URL로 프로바이더 타입을 감지하여 `ProviderFactory`가 적절한 구현체를 생성한다. `EmbeddingGenerator`와 `Translator`는 인터페이스에 의존한다.

**Tech Stack:** Laravel 12, PHP 8.2, PostgreSQL 15 + pgvector, Next.js 15, TypeScript

---

## 파일 구조

### 신규 생성

| 파일 | 책임 |
|------|------|
| `laravel/app/Services/Contracts/EmbeddingProviderInterface.php` | 임베딩 프로바이더 인터페이스 |
| `laravel/app/Services/Contracts/TranslationProviderInterface.php` | 번역 프로바이더 인터페이스 |
| `laravel/app/Services/EmbeddingRateLimiter.php` | 임베딩 전용 Rate Limiter |
| `laravel/app/Services/TranslationRateLimiter.php` | 번역 전용 Rate Limiter |
| `laravel/app/Services/ProviderDetector.php` | URL 기반 프로바이더 타입 감지 |
| `laravel/app/Services/Providers/OllamaEmbeddingProvider.php` | Ollama /api/embed 호출 |
| `laravel/app/Services/Providers/OllamaTranslationProvider.php` | Ollama /api/chat 호출 |
| `laravel/app/Services/Providers/OpenAIEmbeddingProvider.php` | OpenAI /v1/embeddings 호출 |
| `laravel/app/Services/Providers/OpenAITranslationProvider.php` | OpenAI /v1/chat/completions 호출 |
| `laravel/app/Services/ProviderFactory.php` | 프로바이더 인스턴스 생성 |
| `laravel/database/migrations/2026_06_03_migrate_ollama_to_embed_translate.php` | DB 설정 마이그레이션 |

### 수정

| 파일 | 변경 내용 |
|------|-----------|
| `laravel/config/services.php` | `ollama` → `embed` + `translate` |
| `laravel/app/Providers/AppServiceProvider.php` | 바인딩 + boot 설정 변경 |
| `laravel/app/Services/EmbeddingGenerator.php` | 인터페이스 주입 |
| `laravel/app/Services/OllamaTranslator.php` | `Translator.php`로 rename + 인터페이스 주입 |
| `laravel/database/seeders/SettingsSeeder.php` | embed + translate 시더 |
| `laravel/app/Http/Controllers/Api/AdminSettingsController.php` | GROUPS 상수 |
| `laravel/app/Http/Controllers/Api/CategoryController.php` | config 참조 변경 |
| `laravel/app/Http/Controllers/Api/RecommendController.php` | config 참조 변경 |
| `nextjs/components/admin/settings-panel.tsx` | 그룹/필드 라벨 변경 |

### 폐지

| 파일 | 사유 |
|------|------|
| `laravel/app/Services/OllamaClient.php` | 프로바이더 구현체로 분리 |
| `laravel/app/Services/OllamaRateLimiter.php` | 타입별 Rate Limiter로 분리 |

---

## Task 1: 인터페이스 정의

**Files:**
- Create: `laravel/app/Services/Contracts/EmbeddingProviderInterface.php`
- Create: `laravel/app/Services/Contracts/TranslationProviderInterface.php`

- [ ] **Step 1: EmbeddingProviderInterface 생성**

```php
<?php

namespace App\Services\Contracts;

interface EmbeddingProviderInterface
{
    /**
     * 텍스트를 벡터로 변환한다.
     *
     * @param string $model 모델명
     * @param string $text 임베딩할 텍스트
     * @return float[] 임베딩 벡터
     */
    public function embed(string $model, string $text): array;
}
```

- [ ] **Step 2: TranslationProviderInterface 생성**

```php
<?php

namespace App\Services\Contracts;

interface TranslationProviderInterface
{
    /**
     * 채팅 API를 호출하여 응답 content를 반환한다.
     *
     * @param string $model 모델명
     * @param string $prompt 프롬프트
     * @param array $options 추가 옵션
     * @return string 응답 텍스트
     */
    public function chat(string $model, string $prompt, array $options = []): string;
}
```

- [ ] **Step 3: 커밋**

```bash
git add laravel/app/Services/Contracts/
git commit -m "feat: EmbeddingProviderInterface, TranslationProviderInterface 정의"
```

---

## Task 2: Rate Limiter 분리

**Files:**
- Read: `laravel/app/Services/OllamaRateLimiter.php`
- Create: `laravel/app/Services/EmbeddingRateLimiter.php`
- Create: `laravel/app/Services/TranslationRateLimiter.php`

- [ ] **Step 1: EmbeddingRateLimiter 생성**

`OllamaRateLimiter`와 동일 구조이지만 기본 키를 `'embedding'`으로 설정.

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\RateLimiter;

class EmbeddingRateLimiter
{
    public function __construct(
        private int $maxAttempts = 10,
        private int $decaySeconds = 60
    ) {}

    public function attempt(string $key = 'embedding'): bool
    {
        return RateLimiter::attempt($key, $this->maxAttempts, fn () => true, $this->decaySeconds);
    }

    public function tooManyAttempts(string $key = 'embedding'): bool
    {
        return RateLimiter::tooManyAttempts($key, $this->maxAttempts);
    }

    public function availableIn(string $key = 'embedding'): int
    {
        return RateLimiter::availableIn($key);
    }
}
```

- [ ] **Step 2: TranslationRateLimiter 생성**

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\RateLimiter;

class TranslationRateLimiter
{
    public function __construct(
        private int $maxAttempts = 10,
        private int $decaySeconds = 60
    ) {}

    public function attempt(string $key = 'translation'): bool
    {
        return RateLimiter::attempt($key, $this->maxAttempts, fn () => true, $this->decaySeconds);
    }

    public function tooManyAttempts(string $key = 'translation'): bool
    {
        return RateLimiter::tooManyAttempts($key, $this->maxAttempts);
    }

    public function availableIn(string $key = 'translation'): int
    {
        return RateLimiter::availableIn($key);
    }
}
```

- [ ] **Step 3: 커밋**

```bash
git add laravel/app/Services/EmbeddingRateLimiter.php laravel/app/Services/TranslationRateLimiter.php
git commit -m "feat: EmbeddingRateLimiter, TranslationRateLimiter 분리 생성"
```

---

## Task 3: ProviderDetector

**Files:**
- Create: `laravel/app/Services/ProviderDetector.php`

- [ ] **Step 1: ProviderDetector 생성**

```php
<?php

namespace App\Services;

class ProviderDetector
{
    /**
     * URL을 기반으로 프로바이더 타입을 감지한다.
     *
     * - 포트 11434 또는 /api/embed 패턴: 'ollama'
     * - 그 외: 'openai' (OpenAI 호환)
     */
    public function detect(string $url): string
    {
        if (str_contains($url, ':11434') || str_contains($url, '/api/embed')) {
            return 'ollama';
        }

        return 'openai';
    }
}
```

- [ ] **Step 2: 커밋**

```bash
git add laravel/app/Services/ProviderDetector.php
git commit -m "feat: ProviderDetector - URL 기반 프로바이더 타입 감지"
```

---

## Task 4: Ollama 프로바이더 구현체

**Files:**
- Read: `laravel/app/Services/OllamaClient.php`
- Create: `laravel/app/Services/Providers/OllamaEmbeddingProvider.php`
- Create: `laravel/app/Services/Providers/OllamaTranslationProvider.php`

- [ ] **Step 1: OllamaEmbeddingProvider 생성**

`OllamaClient::embed()` 로직을 이동. 재시도 + Rate Limit 포함.

```php
<?php

namespace App\Services\Providers;

use App\Services\Contracts\EmbeddingProviderInterface;
use App\Services\EmbeddingRateLimiter;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

class OllamaEmbeddingProvider implements EmbeddingProviderInterface
{
    private int $httpMaxAttempts;

    public function __construct(
        private string $baseUrl,
        private int $timeout,
        private EmbeddingRateLimiter $rateLimiter,
    ) {
        $this->httpMaxAttempts = 3;
    }

    public function embed(string $model, string $text): array
    {
        $this->checkRateLimit();

        return $this->retryCall(function () use ($model, $text) {
            $response = Http::timeout($this->timeout)
                ->post("{$this->baseUrl}/api/embed", [
                    'model' => $model,
                    'input' => $text,
                ]);

            if ($response->failed()) {
                $response->throw();
            }

            $embedding = $response->json('embeddings.0');

            if ($embedding === null) {
                throw new \RuntimeException('Ollama embed 응답에서 embeddings를 찾을 수 없습니다.');
            }

            return $embedding;
        });
    }

    private function retryCall(callable $fn): mixed
    {
        $attempt = 0;

        while (true) {
            try {
                return $fn();
            } catch (RequestException $e) {
                $statusCode = $e->response->status();
                if (! in_array($statusCode, [429, 500, 502, 503, 504]) && $statusCode !== 0) {
                    throw $e;
                }
                if (++$attempt >= $this->httpMaxAttempts) {
                    throw $e;
                }
                $delay = pow(2, $attempt - 1) * 1000000;
                $delay += random_int(0, 500000);
                usleep($delay);
            } catch (ConnectionException $e) {
                if (++$attempt >= $this->httpMaxAttempts) {
                    throw $e;
                }
                $delay = pow(2, $attempt - 1) * 1000000;
                $delay += random_int(0, 500000);
                usleep($delay);
            }
        }
    }

    private function checkRateLimit(): void
    {
        if ($this->rateLimiter->tooManyAttempts()) {
            $availableIn = $this->rateLimiter->availableIn();
            throw new \RuntimeException("Embedding rate limit exceeded. Available in {$availableIn}s");
        }

        $this->rateLimiter->attempt();
    }
}
```

- [ ] **Step 2: OllamaTranslationProvider 생성**

`OllamaClient::chat()` 로직을 이동.

```php
<?php

namespace App\Services\Providers;

use App\Services\Contracts\TranslationProviderInterface;
use App\Services\TranslationRateLimiter;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

class OllamaTranslationProvider implements TranslationProviderInterface
{
    private int $httpMaxAttempts;

    public function __construct(
        private string $baseUrl,
        private int $timeout,
        private TranslationRateLimiter $rateLimiter,
    ) {
        $this->httpMaxAttempts = 3;
    }

    public function chat(string $model, string $prompt, array $options = []): string
    {
        $this->checkRateLimit();

        $payload = [
            'model' => $model,
            'messages' => [
                ['role' => 'user', 'content' => $prompt],
            ],
            'stream' => false,
        ];

        if (! empty($options)) {
            $payload['options'] = $options;
        }

        return $this->retryCall(function () use ($payload) {
            $response = Http::timeout($this->timeout)
                ->post("{$this->baseUrl}/api/chat", $payload);

            if ($response->failed()) {
                $response->throw();
            }

            $content = $response->json('message.content');

            if ($content === null) {
                throw new \RuntimeException('Ollama chat 응답에서 message.content를 찾을 수 없습니다.');
            }

            return $content;
        });
    }

    private function retryCall(callable $fn): mixed
    {
        $attempt = 0;

        while (true) {
            try {
                return $fn();
            } catch (RequestException $e) {
                $statusCode = $e->response->status();
                if (! in_array($statusCode, [429, 500, 502, 503, 504]) && $statusCode !== 0) {
                    throw $e;
                }
                if (++$attempt >= $this->httpMaxAttempts) {
                    throw $e;
                }
                $delay = pow(2, $attempt - 1) * 1000000;
                $delay += random_int(0, 500000);
                usleep($delay);
            } catch (ConnectionException $e) {
                if (++$attempt >= $this->httpMaxAttempts) {
                    throw $e;
                }
                $delay = pow(2, $attempt - 1) * 1000000;
                $delay += random_int(0, 500000);
                usleep($delay);
            }
        }
    }

    private function checkRateLimit(): void
    {
        if ($this->rateLimiter->tooManyAttempts()) {
            $availableIn = $this->rateLimiter->availableIn();
            throw new \RuntimeException("Translation rate limit exceeded. Available in {$availableIn}s");
        }

        $this->rateLimiter->attempt();
    }
}
```

- [ ] **Step 3: 커밋**

```bash
git add laravel/app/Services/Providers/OllamaEmbeddingProvider.php laravel/app/Services/Providers/OllamaTranslationProvider.php
git commit -m "feat: OllamaEmbeddingProvider, OllamaTranslationProvider 구현"
```

---

## Task 5: OpenAI 호환 프로바이더 구현체

**Files:**
- Create: `laravel/app/Services/Providers/OpenAIEmbeddingProvider.php`
- Create: `laravel/app/Services/Providers/OpenAITranslationProvider.php`

- [ ] **Step 1: OpenAIEmbeddingProvider 생성**

```php
<?php

namespace App\Services\Providers;

use App\Services\Contracts\EmbeddingProviderInterface;
use App\Services\EmbeddingRateLimiter;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

class OpenAIEmbeddingProvider implements EmbeddingProviderInterface
{
    private int $httpMaxAttempts;

    public function __construct(
        private string $baseUrl,
        private string $apiKey,
        private int $timeout,
        private EmbeddingRateLimiter $rateLimiter,
    ) {
        $this->httpMaxAttempts = 3;
    }

    public function embed(string $model, string $text): array
    {
        $this->checkRateLimit();

        return $this->retryCall(function () use ($model, $text) {
            $headers = $this->buildHeaders();

            $response = Http::timeout($this->timeout)
                ->withHeaders($headers)
                ->post("{$this->baseUrl}/v1/embeddings", [
                    'model' => $model,
                    'input' => $text,
                ]);

            if ($response->failed()) {
                $response->throw();
            }

            $embedding = $response->json('data.0.embedding');

            if ($embedding === null) {
                throw new \RuntimeException('OpenAI embeddings 응답에서 data[0].embedding을 찾을 수 없습니다.');
            }

            return $embedding;
        });
    }

    private function buildHeaders(): array
    {
        $headers = ['Content-Type' => 'application/json'];

        if ($this->apiKey !== '') {
            $headers['Authorization'] = "Bearer {$this->apiKey}";
        }

        return $headers;
    }

    private function retryCall(callable $fn): mixed
    {
        $attempt = 0;

        while (true) {
            try {
                return $fn();
            } catch (RequestException $e) {
                $statusCode = $e->response->status();
                if (! in_array($statusCode, [429, 500, 502, 503, 504]) && $statusCode !== 0) {
                    throw $e;
                }
                if (++$attempt >= $this->httpMaxAttempts) {
                    throw $e;
                }
                $delay = pow(2, $attempt - 1) * 1000000;
                $delay += random_int(0, 500000);
                usleep($delay);
            } catch (ConnectionException $e) {
                if (++$attempt >= $this->httpMaxAttempts) {
                    throw $e;
                }
                $delay = pow(2, $attempt - 1) * 1000000;
                $delay += random_int(0, 500000);
                usleep($delay);
            }
        }
    }

    private function checkRateLimit(): void
    {
        if ($this->rateLimiter->tooManyAttempts()) {
            $availableIn = $this->rateLimiter->availableIn();
            throw new \RuntimeException("Embedding rate limit exceeded. Available in {$availableIn}s");
        }

        $this->rateLimiter->attempt();
    }
}
```

- [ ] **Step 2: OpenAITranslationProvider 생성**

```php
<?php

namespace App\Services\Providers;

use App\Services\Contracts\TranslationProviderInterface;
use App\Services\TranslationRateLimiter;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

class OpenAITranslationProvider implements TranslationProviderInterface
{
    private int $httpMaxAttempts;

    public function __construct(
        private string $baseUrl,
        private string $apiKey,
        private int $timeout,
        private TranslationRateLimiter $rateLimiter,
    ) {
        $this->httpMaxAttempts = 3;
    }

    public function chat(string $model, string $prompt, array $options = []): string
    {
        $this->checkRateLimit();

        $payload = [
            'model' => $model,
            'messages' => [
                ['role' => 'user', 'content' => $prompt],
            ],
            'stream' => false,
        ];

        return $this->retryCall(function () use ($payload) {
            $headers = $this->buildHeaders();

            $response = Http::timeout($this->timeout)
                ->withHeaders($headers)
                ->post("{$this->baseUrl}/v1/chat/completions", $payload);

            if ($response->failed()) {
                $response->throw();
            }

            $content = $response->json('choices.0.message.content');

            if ($content === null) {
                throw new \RuntimeException('OpenAI chat 응답에서 choices[0].message.content를 찾을 수 없습니다.');
            }

            return $content;
        });
    }

    private function buildHeaders(): array
    {
        $headers = ['Content-Type' => 'application/json'];

        if ($this->apiKey !== '') {
            $headers['Authorization'] = "Bearer {$this->apiKey}";
        }

        return $headers;
    }

    private function retryCall(callable $fn): mixed
    {
        $attempt = 0;

        while (true) {
            try {
                return $fn();
            } catch (RequestException $e) {
                $statusCode = $e->response->status();
                if (! in_array($statusCode, [429, 500, 502, 503, 504]) && $statusCode !== 0) {
                    throw $e;
                }
                if (++$attempt >= $this->httpMaxAttempts) {
                    throw $e;
                }
                $delay = pow(2, $attempt - 1) * 1000000;
                $delay += random_int(0, 500000);
                usleep($delay);
            } catch (ConnectionException $e) {
                if (++$attempt >= $this->httpMaxAttempts) {
                    throw $e;
                }
                $delay = pow(2, $attempt - 1) * 1000000;
                $delay += random_int(0, 500000);
                usleep($delay);
            }
        }
    }

    private function checkRateLimit(): void
    {
        if ($this->rateLimiter->tooManyAttempts()) {
            $availableIn = $this->rateLimiter->availableIn();
            throw new \RuntimeException("Translation rate limit exceeded. Available in {$availableIn}s");
        }

        $this->rateLimiter->attempt();
    }
}
```

- [ ] **Step 3: 커밋**

```bash
git add laravel/app/Services/Providers/OpenAIEmbeddingProvider.php laravel/app/Services/Providers/OpenAITranslationProvider.php
git commit -m "feat: OpenAIEmbeddingProvider, OpenAITranslationProvider 구현"
```

---

## Task 6: ProviderFactory

**Files:**
- Create: `laravel/app/Services/ProviderFactory.php`

- [ ] **Step 1: ProviderFactory 생성**

```php
<?php

namespace App\Services;

use App\Services\Contracts\EmbeddingProviderInterface;
use App\Services\Contracts\TranslationProviderInterface;
use App\Services\Providers\OllamaEmbeddingProvider;
use App\Services\Providers\OllamaTranslationProvider;
use App\Services\Providers\OpenAIEmbeddingProvider;
use App\Services\Providers\OpenAITranslationProvider;

class ProviderFactory
{
    public function __construct(
        private ProviderDetector $detector,
    ) {}

    public function createEmbeddingProvider(): EmbeddingProviderInterface
    {
        $host = config('services.embed.host', 'http://host.docker.internal:11434');
        $apiKey = config('services.embed.api_key', '');
        $timeout = (int) config('services.embed.timeout', 300);
        $type = $this->detector->detect($host);

        $rateLimiter = new EmbeddingRateLimiter(
            maxAttempts: (int) config('services.embed.rate_limit_max_attempts', 60),
            decaySeconds: (int) config('services.embed.rate_limit_decay_seconds', 60),
        );

        return match ($type) {
            'ollama' => new OllamaEmbeddingProvider($host, $timeout, $rateLimiter),
            'openai' => new OpenAIEmbeddingProvider($host, $apiKey, $timeout, $rateLimiter),
            default => throw new \RuntimeException("지원하지 않는 임베딩 프로바이더: {$type}"),
        };
    }

    public function createTranslationProvider(): TranslationProviderInterface
    {
        $host = config('services.translate.host', 'http://host.docker.internal:11434');
        $apiKey = config('services.translate.api_key', '');
        $timeout = (int) config('services.translate.timeout', 300);
        $type = $this->detector->detect($host);

        $rateLimiter = new TranslationRateLimiter(
            maxAttempts: 60,
            decaySeconds: 60,
        );

        return match ($type) {
            'ollama' => new OllamaTranslationProvider($host, $timeout, $rateLimiter),
            'openai' => new OpenAITranslationProvider($host, $apiKey, $timeout, $rateLimiter),
            default => throw new \RuntimeException("지원하지 않는 번역 프로바이더: {$type}"),
        };
    }
}
```

- [ ] **Step 2: 커밋**

```bash
git add laravel/app/Services/ProviderFactory.php
git commit -m "feat: ProviderFactory - 프로바이더 인스턴스 생성"
```

---

## Task 7: EmbeddingGenerator 수정

**Files:**
- Modify: `laravel/app/Services/EmbeddingGenerator.php`

- [ ] **Step 1: EmbeddingGenerator를 인터페이스 주입으로 변경**

기존:
```php
class EmbeddingGenerator
{
    public function __construct(private OllamaClient $ollama) {}

    public function generate(string $text): array
    {
        $model = config('services.ollama.embedding_model', 'bge-m3:latest');
        return $this->ollama->embed($model, $text);
    }
}
```

변경:
```php
<?php

namespace App\Services;

use App\Services\Contracts\EmbeddingProviderInterface;

class EmbeddingGenerator
{
    public function __construct(
        private EmbeddingProviderInterface $provider,
    ) {}

    /**
     * 텍스트를 1024차원 벡터로 변환한다.
     *
     * @return float[]
     */
    public function generate(string $text): array
    {
        $model = config('services.embed.model', 'bge-m3:latest');

        return $this->provider->embed($model, $text);
    }
}
```

- [ ] **Step 2: 커밋**

```bash
git add laravel/app/Services/EmbeddingGenerator.php
git commit -m "refactor: EmbeddingGenerator를 EmbeddingProviderInterface 주입으로 변경"
```

---

## Task 8: OllamaTranslator → Translator rename

**Files:**
- Rename: `laravel/app/Services/OllamaTranslator.php` → `laravel/app/Services/Translator.php`
- Modify: `laravel/app/Services/Translator.php`

- [ ] **Step 1: Translator.php로 rename 및 수정**

```bash
cd /var/app/www/cl_embed/laravel
mv app/Services/OllamaTranslator.php app/Services/Translator.php
```

파일 내용 변경:
```php
<?php

namespace App\Services;

use App\Models\TranslationCache;
use App\Services\Contracts\TranslationProviderInterface;
use RuntimeException;

class Translator
{
    public function __construct(
        private TranslationProviderInterface $provider,
    ) {}

    // 기존 translate(), translateSingle(), buildPrompt(), isValidTranslation(),
    // hasConsecutiveHangul(), hasConsecutiveHan() 메서드 유지

    // 변경 필요 부분:
    // - translateSingle() 내부 config 참조:
    //   config('services.ollama.translation_model') → config('services.translate.model')
    //   config('services.ollama.translation_max_attempts') → config('services.translate.max_attempts')
    // - $this->ollama->chat() → $this->provider->chat()
}
```

- [ ] **Step 2: Translator.php 전체 코드 작성**

기존 `OllamaTranslator.php`의 전체 코드를 복사하고 다음 변경:
1. 클래스명: `OllamaTranslator` → `Translator`
2. 생성자: `OllamaClient $ollama` → `TranslationProviderInterface $provider`
3. `translateSingle()` 내부:
   - `$model = config('services.ollama.translation_model', 'translategemma:4b')` → `$model = config('services.translate.model', 'translategemma:4b')`
   - `$maxAttempts = (int) config('services.ollama.translation_max_attempts', 3)` → `$maxAttempts = (int) config('services.translate.max_attempts', 3)`
   - `$this->ollama->chat(...)` → `$this->provider->chat(...)`

- [ ] **Step 3: Translator를 사용하는 모든 파일에서 import 변경**

```bash
grep -rn "OllamaTranslator" /var/app/www/cl_embed/laravel/app/ /var/app/www/cl_embed/laravel/tests/ --include="*.php"
```

발견되는 모든 파일에서 `use App\Services\OllamaTranslator` → `use App\Services\Translator`로 변경.

- [ ] **Step 4: 커밋**

```bash
git add laravel/app/Services/Translator.php laravel/app/Services/OllamaTranslator.php
git commit -m "refactor: OllamaTranslator → Translator rename 및 인터페이스 주입"
```

---

## Task 9: config/services.php 변경

**Files:**
- Modify: `laravel/config/services.php`

- [ ] **Step 1: ollama 섹션을 embed + translate로 교체**

기존 (라인 38-47):
```php
'ollama' => [
    'host' => env('OLLAMA_HOST', 'http://host.docker.internal:11434'),
    'translation_model' => 'translategemma:4b',
    'embedding_model' => 'bge-m3:latest',
    'rate_limit_max_attempts' => 60,
    'rate_limit_decay_seconds' => 60,
    'timeout' => 300,
    'translation_max_attempts' => 3,
    'http_max_attempts' => 3,
],
```

변경:
```php
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

- [ ] **Step 2: 커밋**

```bash
git add laravel/config/services.php
git commit -m "refactor: config/services.php - ollama → embed + translate"
```

---

## Task 10: AppServiceProvider 변경

**Files:**
- Modify: `laravel/app/Providers/AppServiceProvider.php`

- [ ] **Step 1: register() 메서드 변경**

기존:
```php
public function register(): void
{
    $this->app->singleton(OllamaRateLimiter::class, function ($app) {
        return new OllamaRateLimiter(
            maxAttempts: (int) config('services.ollama.rate_limit_max_attempts', 60),
            decaySeconds: (int) config('services.ollama.rate_limit_decay_seconds', 60),
        );
    });

    $this->app->singleton(OllamaClient::class, function ($app) {
        return new OllamaClient(
            rateLimiter: $app->make(OllamaRateLimiter::class),
            baseUrl: config('services.ollama.host'),
            timeout: (int) config('services.ollama.timeout', 300),
        );
    });
}
```

변경:
```php
use App\Services\Contracts\EmbeddingProviderInterface;
use App\Services\Contracts\TranslationProviderInterface;
use App\Services\ProviderFactory;

public function register(): void
{
    $this->app->bind(EmbeddingProviderInterface::class, function ($app) {
        return $app->make(ProviderFactory::class)->createEmbeddingProvider();
    });

    $this->app->bind(TranslationProviderInterface::class, function ($app) {
        return $app->make(ProviderFactory::class)->createTranslationProvider();
    });
}
```

- [ ] **Step 2: boot() 메서드 설정 로드 변경**

기존 `services.ollama.*` 설정을 `services.embed.*` + `services.translate.*`로 변경:

```php
$settings = app(SettingsService::class);
config([
    // embed (임베딩)
    'services.embed.host' => $settings->get('embed', 'host', config('services.embed.host')),
    'services.embed.api_key' => $settings->get('embed', 'api_key', ''),
    'services.embed.model' => $settings->get('embed', 'model', 'bge-m3:latest'),
    'services.embed.timeout' => $settings->get('embed', 'timeout', 300),
    'services.embed.rate_limit_max_attempts' => $settings->get('embed', 'rate_limit_max_attempts', 60),
    'services.embed.rate_limit_decay_seconds' => $settings->get('embed', 'rate_limit_decay_seconds', 60),
    // translate (번역)
    'services.translate.host' => $settings->get('translate', 'host', config('services.translate.host')),
    'services.translate.api_key' => $settings->get('translate', 'api_key', ''),
    'services.translate.model' => $settings->get('translate', 'model', 'translategemma:4b'),
    'services.translate.timeout' => $settings->get('translate', 'timeout', 300),
    'services.translate.max_attempts' => $settings->get('translate', 'max_attempts', 3),
    // ... (기존 pagination, recommend, auth 등 유지)
]);
```

- [ ] **Step 3: import 정리**

기존 import 제거:
```php
use App\Services\OllamaClient;
use App\Services\OllamaRateLimiter;
```

신규 import 추가:
```php
use App\Services\Contracts\EmbeddingProviderInterface;
use App\Services\Contracts\TranslationProviderInterface;
use App\Services\ProviderFactory;
```

- [ ] **Step 4: 커밋**

```bash
git add laravel/app/Providers/AppServiceProvider.php
git commit -m "refactor: AppServiceProvider - embed/translate 바인딩 및 설정 로드"
```

---

## Task 11: SettingsSeeder 변경

**Files:**
- Modify: `laravel/database/seeders/SettingsSeeder.php`

- [ ] **Step 1: ollama 시더를 embed + translate로 교체**

기존 ollama 시더 (라인 12-74)를 제거하고 다음으로 교체:

```php
// embed (임베딩)
Setting::firstOrCreate(
    ['group' => 'embed', 'key' => 'host'],
    [
        'value' => 'http://host.docker.internal:11434',
        'type' => 'string',
        'description' => '임베딩 API 서버 주소',
    ]
);

Setting::firstOrCreate(
    ['group' => 'embed', 'key' => 'api_key'],
    [
        'value' => '',
        'type' => 'string',
        'description' => '임베딩 API 키 (Ollama은 불필요)',
    ]
);

Setting::firstOrCreate(
    ['group' => 'embed', 'key' => 'model'],
    [
        'value' => 'bge-m3:latest',
        'type' => 'string',
        'description' => '임베딩 모델명',
    ]
);

Setting::firstOrCreate(
    ['group' => 'embed', 'key' => 'timeout'],
    [
        'value' => '300',
        'type' => 'integer',
        'description' => '임베딩 API HTTP 타임아웃(초)',
    ]
);

Setting::firstOrCreate(
    ['group' => 'embed', 'key' => 'rate_limit_max_attempts'],
    [
        'value' => '60',
        'type' => 'integer',
        'description' => '임베딩 Rate Limit: 시간 창 내 최대 API 호출 횟수',
    ]
);

Setting::firstOrCreate(
    ['group' => 'embed', 'key' => 'rate_limit_decay_seconds'],
    [
        'value' => '60',
        'type' => 'integer',
        'description' => '임베딩 Rate Limit: 시간 창(초)',
    ]
);

// translate (번역)
Setting::firstOrCreate(
    ['group' => 'translate', 'key' => 'host'],
    [
        'value' => 'http://host.docker.internal:11434',
        'type' => 'string',
        'description' => '번역 API 서버 주소',
    ]
);

Setting::firstOrCreate(
    ['group' => 'translate', 'key' => 'api_key'],
    [
        'value' => '',
        'type' => 'string',
        'description' => '번역 API 키 (Ollama은 불필요)',
    ]
);

Setting::firstOrCreate(
    ['group' => 'translate', 'key' => 'model'],
    [
        'value' => 'translategemma:4b',
        'type' => 'string',
        'description' => '번역 모델명',
    ]
);

Setting::firstOrCreate(
    ['group' => 'translate', 'key' => 'timeout'],
    [
        'value' => '300',
        'type' => 'integer',
        'description' => '번역 API HTTP 타임아웃(초)',
    ]
);

Setting::firstOrCreate(
    ['group' => 'translate', 'key' => 'max_attempts'],
    [
        'value' => '3',
        'type' => 'integer',
        'description' => '번역 환각 시 최대 재시도 횟수',
    ]
);
```

- [ ] **Step 2: 커밋**

```bash
git add laravel/database/seeders/SettingsSeeder.php
git commit -m "refactor: SettingsSeeder - ollama → embed + translate"
```

---

## Task 12: DB 마이그레이션

**Files:**
- Create: `laravel/database/migrations/2026_06_03_migrate_ollama_to_embed_translate.php`

- [ ] **Step 1: 마이그레이션 파일 생성**

```bash
cd /var/app/www/cl_embed/laravel
php artisan make:migration migrate_ollama_to_embed_translate --create=settings
```

- [ ] **Step 2: 마이그레이션 코드 작성**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // ollama 설정을 embed + translate로 마이그레이션
        $mappings = [
            // [oldKey, newGroup, newKey]
            ['host', 'embed', 'host'],
            ['host', 'translate', 'host'],
            ['embedding_model', 'embed', 'model'],
            ['translation_model', 'translate', 'model'],
            ['timeout', 'embed', 'timeout'],
            ['timeout', 'translate', 'timeout'],
            ['translation_max_attempts', 'translate', 'max_attempts'],
            ['rate_limit_max_attempts', 'embed', 'rate_limit_max_attempts'],
            ['rate_limit_decay_seconds', 'embed', 'rate_limit_decay_seconds'],
        ];

        foreach ($mappings as [$oldKey, $newGroup, $newKey]) {
            $old = DB::table('settings')
                ->where('group', 'ollama')
                ->where('key', $oldKey)
                ->first();

            if ($old) {
                DB::table('settings')->updateOrInsert(
                    ['group' => $newGroup, 'key' => $newKey],
                    [
                        'value' => $old->value,
                        'type' => $old->type,
                        'description' => $this->getDescription($newGroup, $newKey),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );
            }
        }

        // embed.api_key, translate.api_key 신규 추가
        foreach (['embed', 'translate'] as $group) {
            DB::table('settings')->updateOrInsert(
                ['group' => $group, 'key' => 'api_key'],
                [
                    'value' => '',
                    'type' => 'string',
                    'description' => $group === 'embed' ? '임베딩 API 키' : '번역 API 키',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }

        // ollama 그룹 삭제
        DB::table('settings')->where('group', 'ollama')->delete();
    }

    public function down(): void
    {
        // embed + translate → ollama 롤백
        $ollamaSettings = [
            ['host', 'http://host.docker.internal:11434', 'string', 'Ollama API 서버 주소'],
            ['embedding_model', 'bge-m3:latest', 'string', '임베딩 모델명'],
            ['translation_model', 'translategemma:4b', 'string', '번역 모델명'],
            ['timeout', '300', 'integer', 'HTTP 타임아웃(초)'],
            ['translation_max_attempts', '3', 'integer', '번역 환각 재시도 횟수'],
            ['rate_limit_max_attempts', '60', 'integer', 'Rate Limit 최대 시도'],
            ['rate_limit_decay_seconds', '60', 'integer', 'Rate Limit 시간 창(초)'],
        ];

        foreach ($ollamaSettings as [$key, $value, $type, $description]) {
            DB::table('settings')->updateOrInsert(
                ['group' => 'ollama', 'key' => $key],
                [
                    'value' => $value,
                    'type' => $type,
                    'description' => $description,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }

        DB::table('settings')->whereIn('group', ['embed', 'translate'])->delete();
    }

    private function getDescription(string $group, string $key): string
    {
        $descriptions = [
            'embed' => [
                'host' => '임베딩 API 서버 주소',
                'model' => '임베딩 모델명',
                'timeout' => '임베딩 API HTTP 타임아웃(초)',
                'rate_limit_max_attempts' => '임베딩 Rate Limit 최대 시도',
                'rate_limit_decay_seconds' => '임베딩 Rate Limit 시간 창(초)',
            ],
            'translate' => [
                'host' => '번역 API 서버 주소',
                'model' => '번역 모델명',
                'timeout' => '번역 API HTTP 타임아웃(초)',
                'max_attempts' => '번역 환각 재시도 횟수',
            ],
        ];

        return $descriptions[$group][$key] ?? '';
    }
};
```

- [ ] **Step 3: 마이그레이션 실행**

```bash
cd /var/app/www/cl_embed/laravel
php artisan migrate
```

- [ ] **Step 4: 커밋**

```bash
git add laravel/database/migrations/
git commit -m "feat: ollama 설정을 embed + translate로 마이그레이션"
```

---

## Task 13: AdminSettingsController 변경

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/AdminSettingsController.php`

- [ ] **Step 1: GROUPS 상수 변경**

기존 (라인 17-26):
```php
private const GROUPS = [
    'ollama',
    'pagination',
    'recommend',
    'auth',
    'category',
    'validation',
    'cache',
    'frontend',
];
```

변경:
```php
private const GROUPS = [
    'embed',
    'translate',
    'pagination',
    'recommend',
    'auth',
    'category',
    'validation',
    'cache',
    'frontend',
];
```

- [ ] **Step 2: 커밋**

```bash
git add laravel/app/Http/Controllers/Api/AdminSettingsController.php
git commit -m "refactor: AdminSettingsController GROUPS - ollama → embed + translate"
```

---

## Task 14: 컨트롤러 config 참조 변경

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php:127,270,809`
- Modify: `laravel/app/Http/Controllers/Api/RecommendController.php:124`

- [ ] **Step 1: CategoryController 변경**

3곳의 `config('services.ollama.embedding_model')` → `config('services.embed.model')`로 변경:

```bash
# 확인
grep -n "services\.ollama" laravel/app/Http/Controllers/Api/CategoryController.php
```

라인 127, 270, 809:
```php
// 기존
$embedModelName = config('services.ollama.embedding_model');
// 변경
$embedModelName = config('services.embed.model');
```

- [ ] **Step 2: RecommendController 변경**

라인 124:
```php
// 기존
$modelName = config('services.ollama.embedding_model', 'bge-m3:latest');
// 변경
$modelName = config('services.embed.model', 'bge-m3:latest');
```

- [ ] **Step 3: 커밋**

```bash
git add laravel/app/Http/Controllers/Api/CategoryController.php laravel/app/Http/Controllers/Api/RecommendController.php
git commit -m "refactor: 컨트롤러 config 참조 - ollama → embed"
```

---

## Task 15: 프론트엔드 settings-panel.tsx 변경

**Files:**
- Modify: `nextjs/components/admin/settings-panel.tsx`

- [ ] **Step 1: GROUP_LABELS 변경**

기존 (라인 14-23):
```typescript
const GROUP_LABELS: Record<string, string> = {
  ollama: "Ollama",
  pagination: "페이지네이션",
  // ...
};
```

변경:
```typescript
const GROUP_LABELS: Record<string, string> = {
  embed: "임베딩",
  translate: "번역",
  pagination: "페이지네이션",
  recommend: "추천",
  auth: "인증",
  category: "카테고리",
  validation: "검증",
  cache: "캐시",
  frontend: "프론트엔드",
};
```

- [ ] **Step 2: FIELD_LABELS 변경**

기존 ollama 필드를 embed + translate로 교체:

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

- [ ] **Step 3: API 키 필드 password 타입 처리**

`render` 부분에서 `api_key` 필드는 `type="password"`로 표시하도록 수정:

```tsx
{Object.keys(items).map((key) => {
  const fieldKey = `${group}.${key}`;
  const isInteger = typeof items[key] === "number";
  const isApiKey = key === "api_key";
  return (
    <div key={key} className="flex items-center gap-3">
      <Label className="w-48 shrink-0 text-xs text-muted-foreground">
        {FIELD_LABELS[group]?.[key] ?? key}
      </Label>
      <Input
        type={isApiKey ? "password" : isInteger ? "number" : "text"}
        value={editing[fieldKey] ?? ""}
        onChange={(e) =>
          setEditing((prev) => ({ ...prev, [fieldKey]: e.target.value }))
        }
        className="h-8 text-sm"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={saving[fieldKey]}
        onClick={() => handleSave(group, key)}
      >
        {saving[fieldKey] ? "저장 중" : "저장"}
      </Button>
    </div>
  );
})}
```

- [ ] **Step 4: task-execution.tsx 확인**

`task-execution.tsx`에서 "ollama" 참조 확인:

```bash
grep -n "ollama\|Ollama" nextjs/components/admin/task-execution.tsx
```

라인 262의 주석 `// 단계 간 지연 (Ollama 부하 방지)` → `// 단계 간 지연 (API 부하 방지)`로 변경.

- [ ] **Step 5: 커밋**

```bash
git add nextjs/components/admin/settings-panel.tsx nextjs/components/admin/task-execution.tsx
git commit -m "refactor: settings-panel - ollama → embed + translate, api_key password 필드"
```

---

## Task 16: 테스트 업데이트

**Files:**
- Modify: `laravel/tests/Feature/EmbeddingGeneratorTest.php`
- Modify: `laravel/tests/Feature/OllamaClientTest.php` → 삭제 또는 rename
- Modify: `laravel/tests/Feature/OllamaTranslatorTest.php` → TranslatorTest.php
- Modify: `laravel/tests/Unit/OllamaRateLimiterTest.php` → 삭제 또는 rename
- Modify: `laravel/tests/Unit/Services/OllamaTranslatorTest.php` → TranslatorTest.php
- Modify: `laravel/tests/Feature/SettingsServiceTest.php`
- Modify: `laravel/tests/Feature/SegmentCacheReuseTest.php`
- Modify: `laravel/tests/Feature/RunStepApiTest.php`
- Modify: `laravel/tests/Unit/Services/EmbeddingCacheServiceTest.php`

- [ ] **Step 1: EmbeddingGeneratorTest 수정**

`OllamaClient` mock을 `EmbeddingProviderInterface` mock으로 변경:

```php
// 기존
$this->mock(OllamaClient::class, function ($mock) {
    $mock->shouldReceive('embed')->once()->andReturn([0.1, 0.2]);
});

// 변경
$this->mock(EmbeddingProviderInterface::class, function ($mock) {
    $mock->shouldReceive('embed')->once()->andReturn([0.1, 0.2]);
});
```

- [ ] **Step 2: OllamaClientTest → Provider 테스트로 변경**

`OllamaClientTest.php`를 `OllamaEmbeddingProviderTest.php` + `OllamaTranslationProviderTest.php`로 분리하거나, 테스트 내용을 새 프로바이더에 맞게 수정.

- [ ] **Step 3: OllamaTranslatorTest → TranslatorTest 변경**

클래스명 참조 변경: `OllamaTranslator` → `Translator`

- [ ] **Step 4: SettingsServiceTest 수정**

`ollama` 그룹 참조를 `embed`/`translate`로 변경.

- [ ] **Step 5: RunStepApiTest 수정**

`config('services.ollama.embedding_model')` 참조 변경.

- [ ] **Step 6: 모든 테스트 실행**

```bash
cd /var/app/www/cl_embed/laravel
php artisan test
```

- [ ] **Step 7: 커밋**

```bash
git add laravel/tests/
git commit -m "test: 프로바이더 추상화에 맞게 테스트 업데이트"
```

---

## Task 17: OllamaClient, OllamaRateLimiter 폐지

**Files:**
- Delete: `laravel/app/Services/OllamaClient.php`
- Delete: `laravel/app/Services/OllamaRateLimiter.php`

- [ ] **Step 1: 참조 확인**

```bash
grep -rn "OllamaClient\|OllamaRateLimiter" /var/app/www/cl_embed/laravel/app/ --include="*.php"
```

어떤 파일에서도 참조하지 않는 것을 확인.

- [ ] **Step 2: 파일 삭제**

```bash
rm laravel/app/Services/OllamaClient.php
rm laravel/app/Services/OllamaRateLimiter.php
```

- [ ] **Step 3: 커밋**

```bash
git add laravel/app/Services/OllamaClient.php laravel/app/Services/OllamaRateLimiter.php
git commit -m "refactor: OllamaClient, OllamaRateLimiter 폐지"
```

---

## Task 18: 문서 업데이트

**Files:**
- Modify: `docs/ADR.md`
- Modify: `docs/PRD.md`
- Modify: `docs/UI_GUIDE.md`

- [ ] **Step 1: ADR.md 업데이트**

ADR-003 섹션에서 Ollama 관련 내용을 프로바이더 추상화로 업데이트:

- "Local Ollama models" → "다중 프로바이더 지원 (Ollama, OpenAI 호환)"
- 설정 그룹: `ollama` → `embed` + `translate`
- API 키 지원 추가 명시

- [ ] **Step 2: PRD.md 업데이트**

임베딩/번역 관련 섹션에서:
- "Ollama API" → "임베딩/번역 API (다중 프로바이더)"
- API 키 설정 가능 명시

- [ ] **Step 3: UI_GUIDE.md 업데이트**

Section 6.4 설정 패널 관련:
- "Ollama 설정" → "임베딩/번역 설정"
- API 키 필드 표시 명시

- [ ] **Step 4: 커밋**

```bash
git add docs/ADR.md docs/PRD.md docs/UI_GUIDE.md
git commit -m "docs: 프로바이더 추상화 반영하여 ADR, PRD, UI_GUIDE 업데이트"
```

---

## Task 19: 최종 검증

- [ ] **Step 1: 전체 테스트 실행**

```bash
cd /var/app/www/cl_embed/laravel
php artisan test
```

- [ ] **Step 2: 설정 확인**

```bash
cd /var/app/www/cl_embed/laravel
php artisan tinker
>>> App\Models\Setting::where('group', 'embed')->get()->pluck('key', 'value')
>>> App\Models\Setting::where('group', 'translate')->get()->pluck('key', 'value')
>>> App\Models\Setting::where('group', 'ollama')->count()  // 0이어야 함
```

- [ ] **Step 3: 프론트엔드 빌드 확인**

```bash
cd /var/app/www/cl_embed/nextjs
npm run build
```

- [ ] **Step 4: .claude/hooks/run-all-checks.sh 실행**

```bash
/var/app/www/cl_embed/.claude/hooks/run-all-checks.sh
```

- [ ] **Step 5: 최종 커밋**

```bash
git add -A
git commit -m "feat: 임베딩/번역 프로바이더 추상화 완료

- ollama → embed + translate 그룹 분리
- 전략 패턴 기반 다중 프로바이더 (Ollama, OpenAI 호환)
- API 키 설정 지원
- URL 기반 프로바이더 자동 감지"
```
