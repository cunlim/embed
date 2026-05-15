<?php

namespace App\Repositories;

use App\Models\SearchLog;
use Illuminate\Database\Eloquent\Builder;

class SearchLogRepository
{
    public function findByNormalizedKeyword(string $normalizedKeyword, ?int $userId, string $sessionId): ?SearchLog
    {
        return SearchLog::query()
            ->where('normalized_keyword', $normalizedKeyword)
            ->when(
                $userId !== null,
                fn (Builder $q) => $q->where('user_id', $userId),
                fn (Builder $q) => $q->where('session_id', $sessionId),
            )
            ->latest()
            ->first();
    }

    public function createSearchLog(array $data): SearchLog
    {
        return SearchLog::create($data);
    }
}
