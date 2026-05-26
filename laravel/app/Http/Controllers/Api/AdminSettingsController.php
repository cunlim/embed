<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminSettingsController extends Controller
{
    public function __construct(
        private SettingsService $settings,
    ) {}

    private const GROUPS = [
        'ollama',
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
}
