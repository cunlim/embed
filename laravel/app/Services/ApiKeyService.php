<?php

namespace App\Services;

use App\Models\ApiKey;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class ApiKeyService
{
    /**
     * 새로운 API 키를 생성한다.
     */
    public function create(int $userId, string $name): ApiKey
    {
        return ApiKey::create([
            'user_id' => $userId,
            'name' => $name,
            'key' => ApiKey::generateKey(),
            'status' => 'active',
        ]);
    }

    /**
     * 사용자의 모든 API 키를 생성일 내림차순으로 조회한다.
     */
    public function listByUser(int $userId): Collection
    {
        return ApiKey::where('user_id', $userId)
            ->orderByDesc('created_at')
            ->get();
    }

    /**
     * 키 문자열로 API 키를 조회한다.
     */
    public function findByKey(string $key): ?ApiKey
    {
        return ApiKey::where('key', $key)->first();
    }

    /**
     * ID로 API 키를 조회한다.
     */
    public function findById(int $id): ?ApiKey
    {
        return ApiKey::find($id);
    }

    /**
     * API 키 상태를 업데이트한다. (active/paused)
     */
    public function updateStatus(int $id, string $status): ?ApiKey
    {
        $apiKey = $this->findById($id);

        if ($apiKey === null) {
            return null;
        }

        $apiKey->update(['status' => $status]);

        return $apiKey->fresh();
    }

    /**
     * API 키 이름을 업데이트한다.
     */
    public function updateName(int $id, string $name): ?ApiKey
    {
        $apiKey = $this->findById($id);

        if ($apiKey === null) {
            return null;
        }

        $apiKey->update(['name' => $name]);

        return $apiKey->fresh();
    }

    /**
     * API 키를 삭제한다.
     */
    public function delete(int $id): bool
    {
        $apiKey = $this->findById($id);

        if ($apiKey === null) {
            return false;
        }

        return $apiKey->delete();
    }

    /**
     * API 키의 마지막 사용 일시를 현재 시간으로 갱신한다.
     */
    public function touchLastUsed(int $id): void
    {
        $apiKey = $this->findById($id);

        if ($apiKey !== null) {
            $apiKey->last_used_at = Carbon::now();
            $apiKey->save();
        }
    }
}
