<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ApiKeyStoreRequest;
use App\Http\Requests\ApiKeyUpdateRequest;
use App\Services\ApiKeyService;
use App\Services\ApiUsageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MyPageController extends Controller
{
    public function __construct(
        private ApiKeyService $apiKeyService,
        private ApiUsageService $usageService,
    ) {}

    /**
     * 사용자의 API 키 목록을 반환한다.
     */
    public function apiKeys(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        $keys = $this->apiKeyService->listByUser($user->id);

        return response()->json(['data' => $keys]);
    }

    /**
     * 새로운 API 키를 생성한다.
     * 평문 키는 응답에 1회 포함되며, 이후 조회 시 prefix만 표시된다.
     */
    public function storeApiKey(ApiKeyStoreRequest $request): JsonResponse
    {
        $user = $request->user('sanctum');
        $apiKey = $this->apiKeyService->create($user->id, $request->validated('name'));

        return response()->json([
            'data' => $apiKey,
            'plain_key' => $apiKey->plain_key,
        ], 201);
    }

    /**
     * API 키 정보를 수정한다.
     */
    public function updateApiKey(ApiKeyUpdateRequest $request, int $id): JsonResponse
    {
        $user = $request->user('sanctum');
        $apiKey = $this->apiKeyService->findById($id);

        if ($apiKey === null || $apiKey->user_id !== $user->id) {
            return response()->json(['message' => 'API 키를 찾을 수 없습니다.'], 404);
        }

        if ($request->has('name')) {
            $this->apiKeyService->updateName($id, $request->validated('name'));
        }

        if ($request->has('status')) {
            $this->apiKeyService->updateStatus($id, $request->validated('status'));
        }

        $updated = $this->apiKeyService->findById($id);

        return response()->json(['data' => $updated]);
    }

    /**
     * API 키를 삭제한다.
     */
    public function destroyApiKey(Request $request, int $id): JsonResponse
    {
        $user = $request->user('sanctum');
        $apiKey = $this->apiKeyService->findById($id);

        if ($apiKey === null || $apiKey->user_id !== $user->id) {
            return response()->json(['message' => 'API 키를 찾을 수 없습니다.'], 404);
        }

        $this->apiKeyService->delete($id);

        return response()->json(null, 204);
    }

    /**
     * 사용자의 사용량 요약을 반환한다.
     */
    public function usage(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');

        return response()->json([
            'data' => [
                'total_calls' => $this->usageService->getTotalCalls($user->id),
                'today_calls' => $this->usageService->getTodayCalls($user->id),
                'active_keys' => $this->usageService->getActiveKeyCount($user->id),
                'quota_remaining' => $user->api_quota_remaining,
                'quota_limit' => $user->api_quota_limit,
            ],
        ]);
    }

    /**
     * 최근 사용 내역을 반환한다.
     */
    public function usageHistory(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        $history = $this->usageService->getRecentHistory($user->id);

        return response()->json(['data' => $history]);
    }

    /**
     * 일별 사용량 차트 데이터를 반환한다.
     */
    public function usageChart(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        $chart = $this->usageService->getDailyChart($user->id);

        return response()->json(['data' => $chart]);
    }
}
