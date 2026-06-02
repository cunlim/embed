<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

class OllamaClient
{
    private int $httpMaxAttempts;

    public function __construct(
        private OllamaRateLimiter $rateLimiter,
        private string $baseUrl,
        private int $timeout = 300
    ) {
        $this->httpMaxAttempts = (int) config('services.ollama.http_max_attempts', 3);
    }

    /**
     * Ollama /api/chat 엔드포인트를 호출하여 응답 content를 반환한다.
     */
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

    /**
     * Ollama /api/embed 엔드포인트를 호출하여 임베딩 벡터를 반환한다.
     *
     * @return float[]
     */
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

    /**
     * HTTP 호출을 재시도 로직으로 감싸서 실행한다.
     *
     * 재시도 대상: 연결 타임아웃, HTTP 429/500/502/503/504.
     * 재시도 제외: HTTP 400/401/403/404/422.
     * 지수 백오프 + 지터(jitter) 적용.
     */
    private function retryCall(callable $fn): mixed
    {
        $attempt = 0;
        $maxAttempts = $this->httpMaxAttempts;

        while (true) {
            try {
                return $fn();
            } catch (RequestException $e) {
                $statusCode = $e->response->status();
                // 429, 5xx 서버 에러만 재시도
                if (! in_array($statusCode, [429, 500, 502, 503, 504]) && $statusCode !== 0) {
                    throw $e;
                }
                if (++$attempt >= $maxAttempts) {
                    throw $e;
                }
                // 지수 백오프 1s, 2s, 4s + 0~500ms 지터
                $delay = pow(2, $attempt - 1) * 1000000;
                $delay += random_int(0, 500000);
                usleep($delay);
            } catch (ConnectionException $e) {
                // 연결 타임아웃
                if (++$attempt >= $maxAttempts) {
                    throw $e;
                }
                $delay = pow(2, $attempt - 1) * 1000000;
                $delay += random_int(0, 500000);
                usleep($delay);
            }
        }
    }

    /**
     * Rate Limit 초과 여부를 확인하고 초과 시 예외를 발생시킨다.
     */
    private function checkRateLimit(): void
    {
        if ($this->rateLimiter->tooManyAttempts()) {
            $availableIn = $this->rateLimiter->availableIn();
            throw new \RuntimeException("Ollama rate limit exceeded. Available in {$availableIn}s");
        }

        $this->rateLimiter->attempt();
    }
}
