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
