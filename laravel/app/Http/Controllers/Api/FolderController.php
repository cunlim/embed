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
     *
     * 관리자가 user_id 없이 조회 시 grouped 데이터도 함께 반환 (optgroup 용).
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

        $grouped = null;

        if ($user->isAdmin()) {
            // 관리자: user_id 지정 시 해당 회원, 미지정 시 전체
            if ($userId) {
                $query->where('user_id', (int) $userId);
            } else {
                // user_id 없이 전체 조회 → 회원별 그룹 정보 함께 반환
                $grouped = Category::query()
                    ->whereNotNull('folder')
                    ->select('folder', 'user_id')
                    ->distinct()
                    ->orderBy('folder')
                    ->get()
                    ->groupBy('user_id')
                    ->map(fn ($items, $uid) => [
                        'user_id' => (int) $uid,
                        'user_name' => User::find((int) $uid)?->name ?? '알 수 없음',
                        'folders' => $items->pluck('folder')->toArray(),
                    ])
                    ->values()
                    ->toArray();
            }
        } else {
            // 일반 회원: 본인 폴더만
            $query->where('user_id', $user->id);
        }

        $folders = $query->orderBy('folder')->pluck('folder');

        $result = ['data' => $folders];
        if ($grouped !== null) {
            $result['grouped'] = $grouped;
        }

        return response()->json($result);
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

        $folderName = trim($request->input('folder_name', ''));
        if ($folderName === '') {
            return response()->json(['message' => '폴더명을 입력해주세요.'], 422);
        }

        // 예약된 폴더명 금지
        $reserved = ['기본폴더', '전체'];
        if (in_array($folderName, $reserved, true)) {
            return response()->json(['message' => "'{$folderName}'은(는) 사용할 수 없는 폴더명입니다."], 422);
        }

        // 이미 존재하는지 확인
        $exists = Category::where('folder', $folderName)
            ->when(! $user->isAdmin(), fn ($q) => $q->where('user_id', $user->id))
            ->exists();

        if ($exists) {
            return response()->json(['message' => '이미 존재하는 폴더명입니다.'], 422);
        }

        // 폴더는 더미 카테고리를 생성하여 존재를 표시
        // (folder 필드만 설정된 빈 카테고리)
        $userId = $user->isAdmin() ? (int) $request->input('user_id', $user->id) : $user->id;
        Category::create([
            'user_id' => $userId,
            'category_name_ko' => '__folder_placeholder__',
            'folder' => $folderName,
        ]);

        return response()->json(['message' => "폴더 '{$folderName}'이(가) 생성되었습니다."], 201);
    }

    /**
     * 폴더명 수정
     * PUT /api/folders/{folderName}
     */
    public function update(Request $request, string $folderName): JsonResponse
    {
        /** @var User $user */
        $user = $request->user('sanctum');

        $newName = trim($request->input('new_name', ''));
        if ($newName === '') {
            return response()->json(['message' => '새 폴더명을 입력해주세요.'], 422);
        }

        // 예약된 폴더명 금지
        $reserved = ['기본폴더', '전체'];
        if (in_array($newName, $reserved, true)) {
            return response()->json(['message' => "'{$newName}'은(는) 사용할 수 없는 폴더명입니다."], 422);
        }

        $userId = (int) $request->input('user_id', $user->id);

        $query = Category::where('folder', $folderName)->where('user_id', $userId);
        $count = $query->count();

        if ($count === 0) {
            return response()->json(['message' => '해당 폴더를 찾을 수 없습니다.'], 404);
        }

        $query->update(['folder' => $newName]);

        return response()->json([
            'message' => "폴더명이 '{$folderName}'에서 '{$newName}'(으)로 변경되었습니다.",
            'count' => $count,
        ]);
    }

    /**
     * 폴더 내 카테고리 존재 여부 확인
     * GET /api/folders/{folderName}/has-categories
     */
    public function hasCategories(Request $request, string $folderName): JsonResponse
    {
        /** @var User|null $user */
        $user = $request->user('sanctum');

        if (! $user) {
            return response()->json(['message' => '인증이 필요합니다.'], 401);
        }

        $userId = (int) $request->input('user_id', $user->id);

        $count = Category::where('folder', $folderName)
            ->where('user_id', $userId)
            ->where('category_name_ko', '!=', '__folder_placeholder__')
            ->count();

        return response()->json([
            'data' => [
                'has_categories' => $count > 0,
                'count' => $count,
            ],
        ]);
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
