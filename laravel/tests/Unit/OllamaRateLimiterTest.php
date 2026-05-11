<?php

use App\Services\OllamaRateLimiter;
use Illuminate\Cache\RateLimiter as CacheRateLimiter;
use Tests\TestCase;

uses(TestCase::class);

test('attempt는 RateLimiter attempt에 올바른 파라미터로 위임한다', function () {
    $mock = $this->mock(CacheRateLimiter::class);
    $mock->shouldReceive('attempt')
        ->once()
        ->with('ollama', 60, Mockery::type('Closure'), 60)
        ->andReturn(true);

    $limiter = new OllamaRateLimiter(60, 60);
    $result = $limiter->attempt();

    expect($result)->toBeTrue();
});

test('attempt는 커스텀 키를 사용할 수 있다', function () {
    $mock = $this->mock(CacheRateLimiter::class);
    $mock->shouldReceive('attempt')
        ->once()
        ->with('custom-key', 10, Mockery::type('Closure'), 30)
        ->andReturn(false);

    $limiter = new OllamaRateLimiter(10, 30);
    $result = $limiter->attempt('custom-key');

    expect($result)->toBeFalse();
});

test('tooManyAttempts는 RateLimiter tooManyAttempts에 위임한다', function () {
    $mock = $this->mock(CacheRateLimiter::class);
    $mock->shouldReceive('tooManyAttempts')
        ->once()
        ->with('ollama', 60)
        ->andReturn(false);

    $limiter = new OllamaRateLimiter(60, 60);
    $result = $limiter->tooManyAttempts();

    expect($result)->toBeFalse();
});

test('tooManyAttempts는 초과 시 true를 반환한다', function () {
    $mock = $this->mock(CacheRateLimiter::class);
    $mock->shouldReceive('tooManyAttempts')
        ->once()
        ->with('ollama', 10)
        ->andReturn(true);

    $limiter = new OllamaRateLimiter(10, 30);
    $result = $limiter->tooManyAttempts();

    expect($result)->toBeTrue();
});

test('availableIn는 RateLimiter availableIn에 위임한다', function () {
    $mock = $this->mock(CacheRateLimiter::class);
    $mock->shouldReceive('availableIn')
        ->once()
        ->with('ollama')
        ->andReturn(30);

    $limiter = new OllamaRateLimiter(60, 60);
    $result = $limiter->availableIn();

    expect($result)->toBe(30);
});
