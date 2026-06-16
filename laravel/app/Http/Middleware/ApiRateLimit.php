<?php

namespace App\Http\Middleware;

use App\Services\SettingsService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

class ApiRateLimit
{
    public function __construct(
        private readonly SettingsService $settingsService,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();
        $maxAttempts = $this->settingsService->get('api', 'rate_limit_per_minute', 60);

        if ($token === null || $token === '') {
            // 토큰이 없는 요청은 IP 기반 rate limit 적용
            $key = 'api_rate_limit:ip:'.$request->ip();

            if (RateLimiter::tooManyAttempts($key, $maxAttempts)) {
                $retryAfter = RateLimiter::availableIn($key);

                return response()->json([
                    'code' => 'rate_limit_exceeded',
                    'message' => 'API 호출 한도를 초과했습니다.',
                ], 429)->withHeaders([
                    'Retry-After' => $retryAfter,
                    'X-RateLimit-Limit' => $maxAttempts,
                    'X-RateLimit-Remaining' => 0,
                ]);
            }

            RateLimiter::hit($key, 60);

            return $next($request);
        }

        $key = 'api_rate_limit:'.md5($token);

        if (RateLimiter::tooManyAttempts($key, $maxAttempts)) {
            $retryAfter = RateLimiter::availableIn($key);

            return response()->json([
                'code' => 'rate_limit_exceeded',
                'message' => 'API 호출 한도를 초과했습니다.',
            ], 429)->withHeaders([
                'Retry-After' => $retryAfter,
                'X-RateLimit-Limit' => $maxAttempts,
                'X-RateLimit-Remaining' => 0,
            ]);
        }

        RateLimiter::hit($key, 60);

        $response = $next($request);

        return $response->withHeaders([
            'X-RateLimit-Limit' => $maxAttempts,
            'X-RateLimit-Remaining' => RateLimiter::remaining($key, $maxAttempts),
        ]);
    }
}
