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
