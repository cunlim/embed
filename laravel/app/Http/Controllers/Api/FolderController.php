<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\FolderDeleteRequest;
use App\Http\Requests\MoveFolderRequest;
use App\Models\Category;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FolderController extends Controller
{
    /**
     * 폴더 목록 조회 (인증 필요)
     * GET /api/folders?user_id={userId}
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = $request->user('sanctum');

        // 비로그인: 조회 불가
        if (! $user) {
            return response()->json(['message' => '인증이 필요합니다.'], 401);
        }

        $userId = $request->input('user_id');

        $query = Category::query()
            ->whereNotNull('folder')
            ->distinct()
            ->select('folder');

        if ($user->isAdmin()) {
            // 관리자: user_id 지정 시 해당 회원, 미지정 시 전체
            if ($userId) {
                $query->where('user_id', (int) $userId);
            }
            // user_id 미지정 → 전체 (필터 없음)
        } else {
            // 일반 회원: 본인 폴더만
            $query->where('user_id', $user->id);
        }

        $folders = $query->orderBy('folder')->pluck('folder');

        return response()->json(['data' => $folders]);
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

        // 권한 확인
        if (! $user->isAdmin() && $userId !== $user->id) {
            return response()->json(['message' => '이 회원의 폴더를 삭제할 권한이 없습니다.'], 403);
        }

        $query = Category::where('folder', $folderName)->where('user_id', $userId);
        $count = $query->count();

        if ($count === 0) {
            return response()->json(['message' => '해당 폴더에 카테고리가 없습니다.'], 404);
        }

        if ($moveToDefault) {
            // 기본폴더로 이동
            $query->update(['folder' => null]);

            return response()->json([
                'message' => "폴더 '{$folderName}'의 카테고리 {$count}개를 기본폴더로 이동했습니다.",
                'moved' => $count,
            ]);
        } else {
            // 카테고리도 함께 삭제
            $categoryIds = $query->pluck('id');
            Category::whereIn('id', $categoryIds)->delete();

            return response()->json([
                'message' => "폴더 '{$folderName}'의 카테고리 {$count}개를 삭제했습니다.",
                'deleted' => $count,
            ]);
        }
    }

    /**
     * 카테고리 폴더 이동
     * POST /api/categories/move-folder
     */
    public function moveFolder(MoveFolderRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user('sanctum');
        $categoryIds = $request->input('category_ids', []);
        $targetFolder = $request->input('target_folder'); // null이면 기본폴더

        // category_ids가 비어있으면 현재 사용자의 모든 카테고리 대상
        if (empty($categoryIds)) {
            $query = Category::where('user_id', $user->id);
            $categoryIds = $query->pluck('id')->toArray();
        }

        // 권한 확인: 본인 소유 또는 admin만
        $categories = Category::whereIn('id', $categoryIds)->get();
        $allowedIds = $categories->filter(function ($cat) use ($user) {
            return $user->isAdmin() || $cat->user_id === $user->id;
        })->pluck('id')->toArray();

        if (empty($allowedIds)) {
            return response()->json(['message' => '이동 가능한 카테고리가 없습니다.'], 400);
        }

        Category::whereIn('id', $allowedIds)->update(['folder' => $targetFolder]);

        return response()->json([
            'message' => count($allowedIds).'개 카테고리를 이동했습니다.',
            'moved' => count($allowedIds),
        ]);
    }
}
