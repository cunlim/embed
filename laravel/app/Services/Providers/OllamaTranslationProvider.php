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
