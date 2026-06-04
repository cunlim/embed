<?php

namespace App\Http\Middleware;

use App\Services\ApiKeyService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApiKeyAuth
{
    public function __construct(
        private readonly ApiKeyService $apiKeyService,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if ($token === null || $token === '') {
            return response()->json([
                'code' => 'unauthorized',
                'message' => 'API key가 필요합니다.',
            ], 401);
        }

        $apiKey = $this->apiKeyService->findByKey($token);

        if ($apiKey === null) {
            return response()->json([
                'code' => 'unauthorized',
                'message' => '유효하지 않은 API key입니다.',
            ], 401);
        }

        if ($apiKey->isPaused()) {
            return response()->json([
                'code' => 'key_paused',
                'message' => '일시정지된 API key입니다.',
            ], 403);
        }

        $user = $apiKey->user;

        if (! $user->hasQuota()) {
            return response()->json([
                'code' => 'quota_exceeded',
                'message' => '무료 호출 회수를 초과했습니다.',
            ], 429);
        }

        $request->merge([
            '_api_key_id' => $apiKey->id,
            '_api_user_id' => $user->id,
        ]);

        return $next($request);
    }
}
