<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\FolderDeleteRequest;
use App\Http\Requests\MoveFolderRequest;
use App\Models\Category;
use App\Models\Folder;
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

        if (! $user) {
            return response()->json(['message' => '인증이 필요합니다.'], 401);
        }

        $userId = $request->input('user_id');

        $query = Folder::query()->select('name')->orderBy('name');

        $grouped = null;

        if ($user->isAdmin()) {
            if ($userId) {
                $query->where('user_id', (int) $userId);
            } else {
                // 전체 회원: grouped 데이터 함께 반환 (optgroup 용)
                $grouped = Folder::query()
                    ->join('users', 'folders.user_id', '=', 'users.id')
                    ->select('folders.name', 'folders.user_id', 'users.name as user_name', 'users.email as user_email')
                    ->orderBy('folders.user_id')
                    ->orderBy('folders.name')
                    ->get()
                    ->groupBy('user_id')
                    ->map(fn ($items, $uid) => [
                        'user_id' => (int) $uid,
                        'user_name' => $items->first()->user_name ?? '알 수 없음',
                        'user_email' => $items->first()->user_email ?? '',
                        'folders' => $items->pluck('name')->toArray(),
                    ])
                    ->values()
                    ->toArray();
            }
        } else {
            $query->where('user_id', $user->id);
        }

        $folders = $query->pluck('name');

        $result = ['data' => $folders];
        if ($grouped !== null) {
            $result['grouped'] = $grouped;
        }

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

        $folderName = trim($request->input('folder_name', ''));
        if ($folderName === '') {
            return response()->json(['message' => '폴더명을 입력해주세요.'], 422);
        }

        $reserved = ['기본폴더', '전체'];
        if (in_array($folderName, $reserved, true)) {
            return response()->json(['message' => "'{$folderName}'은(는) 사용할 수 없는 폴더명입니다."], 422);
        }

        $userId = $user->isAdmin() ? (int) $request->input('user_id', $user->id) : $user->id;

        $exists = Folder::where('user_id', $userId)->where('name', $folderName)->exists();
        if ($exists) {
            return response()->json(['message' => '이미 존재하는 폴더명입니다.'], 422);
        }

        Folder::create([
            'user_id' => $userId,
            'name' => $folderName,
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

        $reserved = ['기본폴더', '전체'];
        if (in_array($newName, $reserved, true)) {
            return response()->json(['message' => "'{$newName}'은(는) 사용할 수 없는 폴더명입니다."], 422);
        }

        $userId = (int) $request->input('user_id', $user->id);

        $folder = Folder::where('user_id', $userId)->where('name', $folderName)->first();
        if (! $folder) {
            return response()->json(['message' => '해당 폴더를 찾을 수 없습니다.'], 404);
        }

        // 중복명 확인
        $dupExists = Folder::where('user_id', $userId)->where('name', $newName)
            ->where('id', '!=', $folder->id)->exists();
        if ($dupExists) {
            return response()->json(['message' => '이미 존재하는 폴더명입니다.'], 422);
        }

        $folder->update(['name' => $newName]);

        // categories.folder도 함께 업데이트
        Category::where('folder', $folderName)->where('user_id', $userId)
            ->update(['folder' => $newName]);

        return response()->json([
            'message' => "폴더명이 '{$folderName}'에서 '{$newName}'(으)로 변경되었습니다.",
        ]);
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

        // Folder 존재 확인
        $folder = Folder::where('user_id', $userId)->where('name', $folderName)->first();
        if (! $folder) {
            return response()->json(['message' => '해당 폴더를 찾을 수 없습니다.'], 404);
        }

        $catQuery = Category::where('folder', $folderName)->where('user_id', $userId);
        $count = $catQuery->count();

        if ($moveToDefault && $count > 0) {
            $catQuery->update(['folder' => null]);
        } elseif (! $moveToDefault && $count > 0) {
            $catIds = $catQuery->pluck('id');
            Category::whereIn('id', $catIds)->delete();
        }

        // Folder 레코드 삭제
        $folder->delete();

        $msg = "폴더 '{$folderName}'이(가) 삭제되었습니다.";
        if ($count > 0) {
            $msg .= " {$count}개 카테고리 ".($moveToDefault ? '기본폴더로 이동' : '삭제');
        }

        return response()->json(['message' => $msg]);
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

        $count = Category::where('folder', $folderName)
            ->where('user_id', $userId)
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
        // "기본폴더"는 폴더 미지정을 의미하므로 NULL로 처리
        $targetFolder = $request->input('target_folder') === '기본폴더'
            ? null
            : $request->input('target_folder');

        // category_ids가 비어있으면 현재 사용자의 모든 카테고리 대상
        if (empty($categoryIds)) {
            $query = Category::where('user_id', $user->id);
            $categoryIds = $query->pluck('id')->toArray();
        }

        // 권한 확인: 본인 소유 또는 admin만
        $categories = Category::whereIn('id', $categoryIds)->get();
        $allowed = $categories->filter(function ($cat) use ($user) {
            return $user->isAdmin() || $cat->user_id === $user->id;
        });

        if ($allowed->isEmpty()) {
            return response()->json(['message' => '이동 가능한 카테고리가 없습니다.'], 400);
        }

        // 타겟 폴더에 동일 (category_code, user_id) 중복이 있는지 미리 확인
        // (이동 대상 자신은 제외 — 이미 같은 폴더에 있는 경우 no-op)
        $allowedIds = $allowed->pluck('id')->toArray();
        $allowedCodes = $allowed->pluck('category_code')->unique()->toArray();
        $allowedUserIds = $allowed->pluck('user_id')->unique()->toArray();

        $existingInTarget = Category::where('folder', $targetFolder)
            ->whereIn('category_code', $allowedCodes)
            ->whereIn('user_id', $allowedUserIds)
            ->whereNotIn('id', $allowedIds)
            ->select('category_code', 'user_id')
            ->get()
            ->mapWithKeys(function ($item) {
                return [$item->category_code.'_'.$item->user_id => true];
            });

        $safeIds = [];
        $skipped = 0;

        foreach ($allowed as $cat) {
            $key = $cat->category_code.'_'.$cat->user_id;
            if (isset($existingInTarget[$key])) {
                $skipped++;
            } else {
                $safeIds[] = $cat->id;
            }
        }

        if (! empty($safeIds)) {
            Category::whereIn('id', $safeIds)->update(['folder' => $targetFolder]);
        }

        $moved = count($safeIds);
        $msg = "{$moved}개 이동 성공";
        if ($skipped > 0) {
            $msg .= ", {$skipped}개 실패 (중복)";
        }

        return response()->json([
            'message' => $msg,
            'moved' => $moved,
            'failed' => $skipped,
        ]);
    }
}
