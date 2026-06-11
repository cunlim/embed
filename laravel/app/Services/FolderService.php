<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Folder;
use App\Models\User;
use Illuminate\Support\Collection;

class FolderService
{
    private const array RESERVED_NAMES = ['기본폴더', '전체'];

    /**
     * 폴더 목록 조회. 관리자는 grouped 데이터도 함께 반환합니다.
     *
     * @return array{data: Collection, grouped?: array}
     */
    public function listForUser(?User $user, ?int $userId): array
    {
        $query = Folder::query()->select('name')->orderBy('name');

        $grouped = null;

        if ($user !== null && $user->isAdmin()) {
            if ($userId) {
                $query->where('user_id', $userId);
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

        return $result;
    }

    /**
     * 폴더 생성. 예약명, 중복명을 검증합니다.
     *
     * @return array{success: bool, message: string, folder?: Folder}
     */
    public function create(string $name, int $userId): array
    {
        $name = trim($name);

        if ($name === '') {
            return ['success' => false, 'message' => '폴더명을 입력해주세요.'];
        }

        if (in_array($name, self::RESERVED_NAMES, true)) {
            return ['success' => false, 'message' => "'{$name}'은(는) 사용할 수 없는 폴더명입니다."];
        }

        $exists = Folder::where('user_id', $userId)->where('name', $name)->exists();
        if ($exists) {
            return ['success' => false, 'message' => '이미 존재하는 폴더명입니다.'];
        }

        $folder = Folder::create([
            'user_id' => $userId,
            'name' => $name,
        ]);

        return [
            'success' => true,
            'message' => "폴더 '{$name}'이(가) 생성되었습니다.",
            'folder' => $folder,
        ];
    }

    /**
     * 폴더명 수정. categories.folder도 함께 업데이트합니다.
     *
     * @return array{success: bool, message: string, folder?: Folder}
     */
    public function rename(string $oldName, string $newName, int $userId): array
    {
        $newName = trim($newName);

        if ($newName === '') {
            return ['success' => false, 'message' => '새 폴더명을 입력해주세요.'];
        }

        if (in_array($newName, self::RESERVED_NAMES, true)) {
            return ['success' => false, 'message' => "'{$newName}'은(는) 사용할 수 없는 폴더명입니다."];
        }

        $folder = Folder::where('user_id', $userId)->where('name', $oldName)->first();
        if (! $folder) {
            return ['success' => false, 'message' => '해당 폴더를 찾을 수 없습니다.'];
        }

        // 중복명 확인
        $dupExists = Folder::where('user_id', $userId)
            ->where('name', $newName)
            ->where('id', '!=', $folder->id)
            ->exists();

        if ($dupExists) {
            return ['success' => false, 'message' => '이미 존재하는 폴더명입니다.'];
        }

        $folder->update(['name' => $newName]);

        // categories.folder도 함께 업데이트
        Category::where('folder', $oldName)
            ->where('user_id', $userId)
            ->update(['folder' => $newName]);

        return [
            'success' => true,
            'message' => "폴더명이 '{$oldName}'에서 '{$newName}'(으)로 변경되었습니다.",
            'folder' => $folder,
        ];
    }

    /**
     * 폴더 삭제. move_to_default 옵션에 따라 카테고리를 기본폴더로 이동하거나 삭제합니다.
     *
     * @return array{success: bool, message: string, count: int, duplicate_codes?: string[]}
     */
    public function delete(string $folderName, int $userId, bool $moveToDefault = true): array
    {
        $folder = Folder::where('user_id', $userId)->where('name', $folderName)->first();
        if (! $folder) {
            return ['success' => false, 'message' => '해당 폴더를 찾을 수 없습니다.', 'count' => 0];
        }

        $catQuery = Category::where('folder', $folderName)->where('user_id', $userId);
        $count = $catQuery->count();

        if ($moveToDefault && $count > 0) {
            // 기본폴더 중복 체크
            $duplicateCodes = Category::where('folder', $folderName)
                ->where('user_id', $userId)
                ->whereIn('category_code', function ($query) use ($userId) {
                    $query->select('category_code')
                        ->from('categories')
                        ->whereNull('folder')
                        ->where('user_id', $userId);
                })
                ->pluck('category_code')
                ->toArray();

            if (! empty($duplicateCodes)) {
                return [
                    'success' => false,
                    'message' => '기본폴더에 동일한 카테고리 코드가 있어 이동할 수 없습니다. 중복된 항목을 먼저 처리해주세요.',
                    'count' => $count,
                    'duplicate_codes' => $duplicateCodes,
                ];
            }

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

        return [
            'success' => true,
            'message' => $msg,
            'count' => $count,
        ];
    }

    /**
     * 폴더 내 카테고리 존재 여부 및 기본폴더와의 중복 확인
     *
     * @return array{has_categories: bool, count: int, duplicate_count: int, duplicate_codes: string[]}
     */
    public function hasCategories(string $folderName, int $userId): array
    {
        $count = Category::where('folder', $folderName)
            ->where('user_id', $userId)
            ->count();

        // 중복 체크: 기본폴더(folder IS NULL)에 동일한 (category_code, user_id) 존재 여부
        $duplicateCodes = Category::where('folder', $folderName)
            ->where('user_id', $userId)
            ->whereIn('category_code', function ($query) use ($userId) {
                $query->select('category_code')
                    ->from('categories')
                    ->whereNull('folder')
                    ->where('user_id', $userId);
            })
            ->pluck('category_code')
            ->toArray();

        return [
            'has_categories' => $count > 0,
            'count' => $count,
            'duplicate_count' => count($duplicateCodes),
            'duplicate_codes' => $duplicateCodes,
        ];
    }

    /**
     * 카테고리 폴더 이동. 중복 감지 및 배치 내부 충돌 방지를 포함합니다.
     *
     * @return array{moved: int, failed: int, message: string}
     */
    public function moveCategories(array $categoryIds, ?string $targetFolder, ?int $targetUserId, User $user): array
    {
        // "기본폴더"는 폴더 미지정을 의미하므로 NULL로 처리
        if ($targetFolder === '기본폴더') {
            $targetFolder = null;
        }

        // 관리자만 target_user_id로 소유권 변경 가능
        if ($targetUserId && ! $user->isAdmin()) {
            $targetUserId = null;
        }

        // category_ids가 비어있으면 현재 사용자의 모든 카테고리 대상
        if (empty($categoryIds)) {
            $categoryIds = Category::where('user_id', $user->id)->pluck('id')->toArray();
        }

        // 권한 확인: 본인 소유 또는 admin만
        $categories = Category::whereIn('id', $categoryIds)->get();
        $allowed = $categories->filter(function ($cat) use ($user) {
            return $user->isAdmin() || $cat->user_id === $user->id;
        });

        if ($allowed->isEmpty()) {
            return ['moved' => 0, 'failed' => 0, 'message' => '이동 가능한 카테고리가 없습니다.'];
        }

        // 타겟 폴더에 동일 (category_code, user_id) 중복이 있는지 미리 확인
        $allowedCodes = $allowed->pluck('category_code')->unique()->toArray();

        // 중복 체크 시 사용할 user_id: 소유권 변경 시 targetUserId, 아니면 원본 user_id들
        $checkUserIds = $targetUserId
            ? [$targetUserId]
            : $allowed->pluck('user_id')->unique()->toArray();

        $existingInTarget = Category::where('folder', $targetFolder)
            ->whereIn('category_code', $allowedCodes)
            ->whereIn('user_id', $checkUserIds)
            ->select('id', 'category_code', 'user_id')
            ->get();

        // 타겟 폴더에 이미 존재하는 (category_code, user_id) 조합 맵
        $conflictKeys = $existingInTarget->mapWithKeys(function ($item) {
            return [$item->category_code.'_'.$item->user_id => $item->id];
        });

        $safeIds = [];
        $skipped = 0;

        foreach ($allowed as $cat) {
            // 소유권 변경 시 새로운 user_id로 중복 체크
            $checkUserId = $targetUserId ?? $cat->user_id;
            $key = $cat->category_code.'_'.$checkUserId;
            if (isset($conflictKeys[$key])) {
                // 타겟 폴더에 이미 동일 (code, user_id) 존재 → 스킵
                $skipped++;
            } else {
                $safeIds[] = $cat->id;
                // 배치 내부 중복 방지: 이후 항목과의 충돌 방지
                $conflictKeys[$key] = $cat->id;
            }
        }

        if (! empty($safeIds)) {
            if ($targetUserId && $user->isAdmin()) {
                Category::whereIn('id', $safeIds)->update([
                    'folder' => $targetFolder,
                    'user_id' => $targetUserId,
                ]);
            } else {
                Category::whereIn('id', $safeIds)->update(['folder' => $targetFolder]);
            }
        }

        $moved = count($safeIds);
        $msg = "{$moved}개 이동 성공";
        if ($skipped > 0) {
            $msg .= ", {$skipped}개 실패 (중복)";
        }

        return [
            'moved' => $moved,
            'failed' => $skipped,
            'message' => $msg,
        ];
    }
}
