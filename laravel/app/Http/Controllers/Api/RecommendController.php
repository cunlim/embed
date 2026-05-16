<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RecommendRequest;
use App\Http\Resources\RecommendResource;
use App\Services\EmbeddingCacheService;
use App\Services\RecommendationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;
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
        description: '입력 텍스트를 분석하여 pgvector 코사인 유사도 기반으로 가장 적합한 상위 5개 카테고리를 추천합니다.',
        tags: ['Recommend'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['text', 'target_language'],
                properties: [
                    new OA\Property(property: 'text', type: 'string', minLength: 1, maxLength: 500),
                    new OA\Property(property: 'target_language', type: 'string', enum: ['ko', 'zh', 'en']),
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
        $validated = $request->validated();
        $text = $validated['text'];
        $targetLanguage = $validated['target_language'];

        $sessionId = $request->hasSession()
            ? $request->session()->getId()
            : (string) Str::uuid();
        $userId = auth()->id();
        $modelName = config('services.ollama.embedding_model', 'bge-m3:latest');

        $searchLog = $this->embeddingCache->getOrCreateEmbedding(
            $text, $modelName, $userId, $sessionId
        );

        $recommendations = $this->recommendation->recommend($searchLog, $targetLanguage);

        return RecommendResource::collection($recommendations)->response();
    }
}
