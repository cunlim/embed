<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\FolderDeleteRequest;
use App\Http\Requests\MoveFolderRequest;
use App\Models\User;
use App\Services\FolderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FolderController extends Controller
{
    public function __construct(
        private FolderService $folderService,
    ) {}

    /**
     * 폴더 목록 조회 (인증 필요)
     * GET /api/folders?user_id={userId}
     *
     * 관리자가 user_id 없이 조회 시 grouped 데이터도 함께 반환 (optgroup 용).
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = $request->user('sanctum');

        if (! $user) {
            return response()->json(['message' => '인증이 필요합니다.'], 401);
        }

        $userId = $request->input('user_id') ? (int) $request->input('user_id') : null;

        $result = $this->folderService->listForUser($user, $userId);

        return response()->json($result);
    }

    /**
     * 폴더 생성
     * POST /api/folders
     */
    public function store(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = $request->user('sanctum');

        if (! $user) {
            return response()->json(['message' => '인증이 필요합니다.'], 401);
        }

        $folderName = $request->input('folder_name', '');
        $userId = $user->isAdmin() ? (int) $request->input('user_id', $user->id) : $user->id;

        $result = $this->folderService->create($folderName, $userId);

        if (! $result['success']) {
            $status = str_contains($result['message'], '입력해주세요') ? 422 : 422;

            return response()->json(['message' => $result['message']], $status);
        }

        return response()->json(['message' => $result['message']], 201);
    }

    /**
     * 폴더명 수정
     * PUT /api/folders/{folderName}
     */
    public function update(Request $request, string $folderName): JsonResponse
    {
        /** @var User $user */
        $user = $request->user('sanctum');

        $newName = $request->input('new_name', '');
        $userId = (int) $request->input('user_id', $user->id);

        $result = $this->folderService->rename($folderName, $newName, $userId);

        if (! $result['success']) {
            $status = str_contains($result['message'], '찾을 수 없습니다') ? 404 : 422;

            return response()->json(['message' => $result['message']], $status);
        }

        return response()->json(['message' => $result['message']]);
    }

    /**
     * 폴더 삭제
     * DELETE /api/folders/{folderName}
     */
    public function destroy(FolderDeleteRequest $request, string $folderName): JsonResponse
    {
        /** @var User $user */
        $user = $request->user('sanctum');
        $userId = (int) $request->input('user_id', $user->id);
        $moveToDefault = $request->boolean('move_to_default', true);

        if (! $user->isAdmin() && $userId !== $user->id) {
            return response()->json(['message' => '이 회원의 폴더를 삭제할 권한이 없습니다.'], 403);
        }

        $result = $this->folderService->delete($folderName, $userId, $moveToDefault);

        if (! $result['success']) {
            $status = str_contains($result['message'], '찾을 수 없습니다') ? 404 : 409;
            $response = ['message' => $result['message']];
            if (isset($result['duplicate_codes'])) {
                $response['duplicate_count'] = count($result['duplicate_codes']);
                $response['duplicate_codes'] = $result['duplicate_codes'];
            }

            return response()->json($response, $status);
        }

        return response()->json(['message' => $result['message']]);
    }

    /**
     * 폴더 내 카테고리 존재 여부 확인
     * GET /api/folders/{folderName}/has-categories
     */
    public function hasCategories(Request $request, string $folderName): JsonResponse
    {
        $user = $request->user('sanctum');
        if (! $user) {
            return response()->json(['message' => '인증이 필요합니다.'], 401);
        }

        $userId = (int) $request->input('user_id', $user->id);

        $result = $this->folderService->hasCategories($folderName, $userId);

        return response()->json(['data' => $result]);
    }

    /**
     * 카테고리 폴더 이동
     * POST /api/categories/move-folder
     */
    public function moveFolder(MoveFolderRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user('sanctum');

        $result = $this->folderService->moveCategories(
            $request->input('category_ids', []),
            $request->input('target_folder'),
            $request->input('target_user_id'),
            $user
        );

        return response()->json($result);
    }
}
