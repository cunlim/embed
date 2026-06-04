<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ApiSearchRequest;
use App\Http\Resources\ApiSearchResource;
use App\Services\ApiKeyService;
use App\Services\ApiUsageService;
use App\Services\EmbeddingCacheService;
use App\Services\RecommendationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ApiController extends Controller
{
    public function __construct(
        private EmbeddingCacheService $embeddingCache,
        private RecommendationService $recommendation,
        private ApiUsageService $apiUsage,
        private ApiKeyService $apiKey,
    ) {}

    /**
     * POST /api/v1/search — API 검색 엔드포인트
     */
    public function search(ApiSearchRequest $request): JsonResponse
    {
        $startTime = microtime(true);

        $validated = $request->validated();

        // 기본값 설정
        $targetLanguage = $validated['target_language'] ?? 'ko';
        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 20);
        $keyword = $validated['keyword'] ?? null;
        $folder = $validated['folder'] ?? null;
        $text = $validated['text'];
        $mode = $validated['mode'] ?? 'search';
        $lang = $validated['lang'] ?? null;
        $slang = $validated['slang'] ?? null;

        // mode=search → searchLang=null, mode=hierarchy+lang → searchLang=lang
        $searchLang = null;
        if ($mode === 'hierarchy' && $lang) {
            $searchLang = $lang;
        }

        // slang → targetLanguage로 사용
        if ($slang) {
            $targetLanguage = $slang;
        }

        // API 키 인증 정보
        $apiKeyId = $request->input('_api_key_id');
        $userId = $request->input('_api_user_id');

        // 임베딩 생성/캐시 조회
        $modelName = config('services.embed.model', 'bge-m3:latest');
        $searchLog = $this->embeddingCache->getOrCreateEmbedding(
            $text, $modelName, $userId
        );

        // 유사도 기반 추천
        $results = $this->recommendation->recommendPaginated(
            $searchLog,
            $targetLanguage,
            $perPage,
            $page,
            $userId,
            $keyword,
            $folder,
            $searchLang
        );

        $processingTimeMs = (int) ((microtime(true) - $startTime) * 1000);

        // 사용 로그 기록
        $this->apiUsage->log(
            $apiKeyId,
            $userId,
            '/api/v1/search',
            $validated,
            200,
            $processingTimeMs
        );

        // 쿼터 차감
        DB::table('users')
            ->where('id', $userId)
            ->decrement('api_quota_remaining', 1);

        // 마지막 사용 시간 갱신
        $this->apiKey->touchLastUsed($apiKeyId);

        return ApiSearchResource::collection($results)
            ->response()
            ->header('X-Processing-Time-Ms', $processingTimeMs);
    }
}
