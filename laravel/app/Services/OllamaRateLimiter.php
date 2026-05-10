<?php

namespace App\Services;

use Illuminate\Support\Facades\RateLimiter;

class OllamaRateLimiter
{
    public function __construct(
        private int $maxAttempts = 10,
        private int $decaySeconds = 60
    ) {}

    /**
     * Ollama API 호출을 1회 시도로 기록한다.
     */
    public function attempt(string $key = 'ollama'): bool
    {
        return RateLimiter::attempt($key, $this->maxAttempts, fn () => true, $this->decaySeconds);
    }

    /**
     * 주어진 시간 창 내에 최대 시도 횟수를 초과했는지 확인한다.
     */
    public function tooManyAttempts(string $key = 'ollama'): bool
    {
        return RateLimiter::tooManyAttempts($key, $this->maxAttempts);
    }

    /**
     * 다음 요청 가능 시점까지 남은 초를 반환한다.
     */
    public function availableIn(string $key = 'ollama'): int
    {
        return RateLimiter::availableIn($key);
    }
}
