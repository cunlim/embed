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
