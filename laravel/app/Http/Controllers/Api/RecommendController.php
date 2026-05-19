<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RecommendRequest;
use App\Http\Resources\RecommendResource;
use App\Models\Category;
use App\Services\EmbeddingCacheService;
use App\Services\RecommendationService;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

class RecommendController extends Controller
{
    public function __construct(
        private EmbeddingCacheService $embeddingCache,
        private RecommendationService $recommendation,
    ) {}

    #[OA\Post(
        path: '/api/recommend',
        summary: '카테고리 추천',
        description: '입력 텍스트를 분석하여 pgvector 코사인 유사도 기반으로 카테고리를 추천합니다. text가 비어있으면 일반 카테고리 목록을 페이지네이션으로 반환합니다.',
        tags: ['Recommend'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['target_language'],
                properties: [
                    new OA\Property(property: 'text', type: 'string', maxLength: 500, nullable: true),
                    new OA\Property(property: 'target_language', type: 'string', enum: ['ko', 'zh', 'en']),
                    new OA\Property(property: 'page', type: 'integer', minimum: 1, default: 1),
                    new OA\Property(property: 'per_page', type: 'integer', minimum: 1, maximum: 100, default: 20),
                ]
            )
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: '추천 결과',
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
                    ]
                )
            ),
            new OA\Response(
                response: 422,
                description: '입력값 검증 실패',
            ),
        ]
    )]
    public function recommend(RecommendRequest $request): JsonResponse
    {
        $text = $request->validated('text');
        $targetLanguage = $request->validated('target_language');
        $page = (int) $request->input('page', 1);
        $perPage = (int) $request->input('per_page', 20);

        // text가 없거나 빈 문자열이면 일반 카테고리 목록 반환
        if (empty(trim((string) $text))) {
            $categories = Category::orderBy("category_name_{$targetLanguage}")
                ->paginate(perPage: $perPage, page: $page);

            return RecommendResource::collection($categories)->response();
        }

        $userId = auth('sanctum')->id();
        $modelName = config('services.ollama.embedding_model', 'bge-m3:latest');

        $searchLog = $this->embeddingCache->getOrCreateEmbedding(
            $text, $modelName, $userId
        );

        $results = $this->recommendation->recommendPaginated(
            $searchLog, $targetLanguage, $perPage, $page
        );

        return RecommendResource::collection($results)->response();
    }
}
