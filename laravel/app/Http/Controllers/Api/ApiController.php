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
use OpenApi\Attributes as OA;

class ApiController extends Controller
{
    public function __construct(
        private EmbeddingCacheService $embeddingCache,
        private RecommendationService $recommendation,
        private ApiUsageService $apiUsage,
        private ApiKeyService $apiKey,
    ) {}

    #[OA\Post(
        path: '/api/v1/search',
        summary: '외부 API 유사도 검색',
        description: 'API 키 기반 카테고리 유사도 검색. Authorization: Bearer {api_key} 헤더로 인증하며, 호출 시 쿼터가 차감됩니다.',
        tags: ['External API'],
        security: [['ApiKeyAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['similarity_query'],
                properties: [
                    new OA\Property(property: 'folder', type: 'string', maxLength: 100, default: '', description: '폴더명 필터 (빈 문자열: 전체)'),
                    new OA\Property(property: 'similarity_query', type: 'string', maxLength: 500, description: '유사도 검색 텍스트'),
                    new OA\Property(property: 'translation_lang', type: 'string', enum: ['ko', 'en', 'zh'], default: 'ko', description: '유사도 검색 및 결과 표시 언어'),
                    new OA\Property(property: 'search_mode', type: 'string', enum: ['search', 'hierarchy'], default: 'search', description: '검색 모드 (search: 일반, hierarchy: 분류선택)'),
                    new OA\Property(property: 'like_query', type: 'string', maxLength: 500, default: '', description: '접두사 필터 키워드 (search_mode=hierarchy에서 유용)'),
                    new OA\Property(property: 'hierarchy_lang', type: 'string', enum: ['ko', 'en', 'zh'], default: 'ko', description: 'search_mode=hierarchy일 때 접두사 검색 언어'),
                    new OA\Property(property: 'page_number', type: 'integer', minimum: 1, default: 1),
                    new OA\Property(property: 'page_size', type: 'integer', minimum: 1, maximum: 50, default: 20),
                ]
            )
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: '검색 결과',
                headers: [
                    new OA\Header(header: 'X-Processing-Time-Ms', description: '처리 시간(ms)', schema: new OA\Schema(type: 'integer')),
                ],
                content: new OA\JsonContent(
                    type: 'object',
                    properties: [
                        new OA\Property(property: 'data', type: 'array', items: new OA\Items(
                            properties: [
                                new OA\Property(property: 'category_code', type: 'string'),
                                new OA\Property(property: 'category_name', type: 'string'),
                                new OA\Property(property: 'similarity_score', type: 'number', example: 0.9876),
                            ]
                        )),
                        new OA\Property(property: 'meta', type: 'object', properties: [
                            new OA\Property(property: 'current_page', type: 'integer'),
                            new OA\Property(property: 'last_page', type: 'integer'),
                            new OA\Property(property: 'per_page', type: 'integer'),
                            new OA\Property(property: 'total', type: 'integer'),
                        ]),
                    ]
                )
            ),
            new OA\Response(
                response: 401,
                description: 'API 키 인증 실패',
            ),
            new OA\Response(
                response: 422,
                description: '입력값 검증 실패',
            ),
            new OA\Response(
                response: 429,
                description: '쿼터 초과',
            ),
        ]
    )]
    public function search(ApiSearchRequest $request): JsonResponse
    {
        $startTime = microtime(true);

        $validated = $request->validated();

        // 기본값 설정
        $targetLanguage = $validated['translation_lang'] ?? 'ko';
        $page = (int) ($validated['page_number'] ?? 1);
        $perPage = (int) ($validated['page_size'] ?? 20);
        $keyword = $validated['like_query'] ?? null;
        $folder = $validated['folder'] ?? null;
        $text = $validated['similarity_query'];
        $mode = $validated['search_mode'] ?? 'search';
        $lang = $validated['hierarchy_lang'] ?? 'ko';

        // search_mode=search → searchLang=null, search_mode=hierarchy+hierarchy_lang → searchLang=hierarchy_lang
        $searchLang = null;
        if ($mode === 'hierarchy' && $lang) {
            $searchLang = $lang;
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

        // 쿼터 차감 (원자적 — 동시 요청으로 quota 음수 방지)
        DB::table('users')
            ->where('id', $userId)
            ->where('api_quota_remaining', '>', 0)
            ->decrement('api_quota_remaining', 1);

        // 마지막 사용 시간 갱신
        $this->apiKey->touchLastUsed($apiKeyId);

        // 불필요한 필드(links, meta.links, meta.path 등) 제거
        $data = ApiSearchResource::collection($results)->response()->getData(true);

        return response()->json([
            'data' => $data['data'],
            'meta' => [
                'current_page' => $data['meta']['current_page'],
                'last_page' => $data['meta']['last_page'],
                'per_page' => $data['meta']['per_page'],
                'total' => $data['meta']['total'],
            ],
        ], 200)->header('X-Processing-Time-Ms', $processingTimeMs);
    }
}
