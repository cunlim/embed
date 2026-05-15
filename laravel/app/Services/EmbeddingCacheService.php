<?php

namespace App\Services;

use App\Models\SearchLog;
use App\Repositories\SearchLogRepository;
use Illuminate\Support\Facades\Log;

class EmbeddingCacheService
{
    public function __construct(
        private SearchLogRepository $repository,
        private EmbeddingGenerator $generator,
        private SearchNormalizer $normalizer,
    ) {}

    public function getOrCreateEmbedding(string $keyword, string $modelName, ?int $userId, string $sessionId): SearchLog
    {
        $normalized = $this->normalizer->normalize($keyword);

        $start = microtime(true);

        $existing = $this->repository->findByNormalizedKeyword($normalized, $userId, $sessionId);

        if ($existing !== null) {
            $elapsed = (microtime(true) - $start) * 1000;
            Log::info('EmbeddingCacheService: cache hit', [
                'keyword' => $keyword,
                'normalized' => $normalized,
                'elapsed_ms' => round($elapsed, 2),
            ]);

            return $existing;
        }

        $embedding = $this->generator->generate($keyword);

        $searchLog = $this->repository->createSearchLog([
            'user_id' => $userId,
            'session_id' => $sessionId,
            'search_keyword' => $keyword,
            'normalized_keyword' => $normalized,
            'embed_model_name' => $modelName,
        ]);

        $searchLog->update(['embedding' => $embedding]);

        $elapsed = (microtime(true) - $start) * 1000;
        Log::info('EmbeddingCacheService: cache miss', [
            'keyword' => $keyword,
            'normalized' => $normalized,
            'elapsed_ms' => round($elapsed, 2),
        ]);

        return $searchLog->refresh();
    }
}
