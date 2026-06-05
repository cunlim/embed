<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\QuotaAdjustRequest;
use App\Models\User;
use App\Services\ApiUsageService;
use App\Services\SettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminSettingsController extends Controller
{
    public function __construct(
        private SettingsService $settings,
        private ApiUsageService $usageService,
    ) {}

    private const GROUPS = [
        'embed',
        'translate',
        'pagination',
        'recommend',
        'auth',
        'category',
        'validation',
        'cache',
        'frontend',
    ];

    /**
     * 모든 그룹의 설정을 반환한다.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        if (! $user || ! $user->isSuperAdmin()) {
            return response()->json(['message' => '권한이 없습니다.'], 403);
        }

        $data = [];
        foreach (self::GROUPS as $group) {
            $data[$group] = $this->settings->all($group);
        }

        return response()->json(['data' => $data]);
    }

    /**
     * 단일 설정 값을 업데이트한다.
     */
    public function update(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        if (! $user || ! $user->isSuperAdmin()) {
            return response()->json(['message' => '권한이 없습니다.'], 403);
        }

        $validated = $request->validate([
            'group' => ['required', 'string', 'max:50'],
            'key' => ['required', 'string', 'max:100'],
            'value' => ['required'],
        ]);

        $setting = $this->settings->update(
            $validated['group'],
            $validated['key'],
            $validated['value']
        );

        return response()->json([
            'data' => [
                'group' => $setting->group,
                'key' => $setting->key,
                'value' => $this->settings->get($setting->group, $setting->key),
            ],
        ]);
    }

    /**
     * 회원 목록 조회 (관리자용)
     * GET /api/admin/users
     */
    public function users(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        if (! $user || ! $user->isSuperAdmin()) {
            return response()->json(['message' => '권한이 없습니다.'], 403);
        }

        $users = User::select('id', 'name', 'email', 'role', 'created_at')->orderBy('name')->get();

        return response()->json(['data' => $users]);
    }

    /**
     * 회원 상세 정보 조회 (관리자용)
     * GET /api/admin/users/{id}
     */
    public function userDetail(Request $request, int $id): JsonResponse
    {
        $user = $request->user('sanctum');
        if (! $user || ! $user->isSuperAdmin()) {
            return response()->json(['message' => '권한이 없습니다.'], 403);
        }

        $targetUser = User::select('id', 'name', 'email', 'role', 'created_at', 'api_quota_remaining', 'api_quota_limit')->find($id);

        if ($targetUser === null) {
            return response()->json(['message' => '회원을 찾을 수 없습니다.'], 404);
        }

        $totalCalls = $this->usageService->getTotalCalls($targetUser->id);
        $todayCalls = $this->usageService->getTodayCalls($targetUser->id);
        $activeKeys = $this->usageService->getActiveKeyCount($targetUser->id);
        $callsByKey = $this->usageService->getCallsByKey($targetUser->id);

        return response()->json([
            'data' => array_merge(
                $targetUser->toArray(),
                [
                    'total_calls' => $totalCalls,
                    'today_calls' => $todayCalls,
                    'active_keys' => $activeKeys,
                    'calls_by_key' => $callsByKey,
                ]
            ),
        ]);
    }

    /**
     * 회원 API quota를 조정한다 (관리자용)
     * PATCH /api/admin/users/{id}/quota
     */
    public function adjustQuota(QuotaAdjustRequest $request, int $id): JsonResponse
    {
        $user = User::find($id);

        if ($user === null) {
            return response()->json(['message' => '회원을 찾을 수 없습니다.'], 404);
        }

        $type = $request->validated('type');
        $value = (int) $request->validated('value');

        if ($type === 'absolute') {
            $user->update([
                'api_quota_remaining' => $value,
                'api_quota_limit' => $value,
            ]);
        } else {
            // increment/decrement — 최소값 0 보장
            $newRemaining = max(0, $user->api_quota_remaining + $value);
            $newLimit = max(0, $user->api_quota_limit + $value);
            $user->update([
                'api_quota_remaining' => $newRemaining,
                'api_quota_limit' => $newLimit,
            ]);
        }

        $user = $user->fresh();

        $totalCalls = $this->usageService->getTotalCalls($user->id);
        $todayCalls = $this->usageService->getTodayCalls($user->id);
        $activeKeys = $this->usageService->getActiveKeyCount($user->id);
        $callsByKey = $this->usageService->getCallsByKey($user->id);

        return response()->json([
            'data' => array_merge(
                $user->toArray(),
                [
                    'total_calls' => $totalCalls,
                    'today_calls' => $todayCalls,
                    'active_keys' => $activeKeys,
                    'calls_by_key' => $callsByKey,
                ]
            ),
        ]);
    }
}
