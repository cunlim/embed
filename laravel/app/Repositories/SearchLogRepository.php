<?php

namespace App\Repositories;

use App\Models\SearchLog;

class SearchLogRepository
{
    public function findByNormalizedKeyword(string $normalizedKeyword): ?SearchLog
    {
        return SearchLog::query()
            ->where('normalized_keyword', $normalizedKeyword)
            ->latest()
            ->first();
    }

    public function createSearchLog(array $data): SearchLog
    {
        return SearchLog::create($data);
    }
}
