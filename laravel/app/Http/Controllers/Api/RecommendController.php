<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RecommendRequest;
use App\Http\Resources\RecommendResource;
use App\Models\Category;
use App\Services\EmbeddingGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class RecommendController extends Controller
{
    public function __construct(
        private EmbeddingGenerator $embeddingGenerator
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
                    properties: [
                        new OA\Property(property: 'data', type: 'array', items: new OA\Items(
                            properties: [
                                new OA\Property(property: 'category_code', type: 'string'),
                                new OA\Property(property: 'category_name', type: 'string'),
                                new OA\Property(property: 'similarity_score', type: 'number'),
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

        // 검색어 임베딩 생성
        $queryVector = $this->embeddingGenerator->generate($text);

        // pgvector 코사인 유사도 쿼리 실행
        $vectorLiteral = '['.implode(',', $queryVector).']';

        $results = DB::select(
            'SELECT ce.category_id, ce.embedding <=> :query_vector AS distance
             FROM category_embeddings ce
             WHERE ce.language = :lang
             ORDER BY distance ASC
             LIMIT 5',
            [
                'query_vector' => $vectorLiteral,
                'lang' => $targetLanguage,
            ]
        );

        // category_id 목록 추출
        $categoryIds = array_column($results, 'category_id');
        $distanceMap = [];
        foreach ($results as $row) {
            $distanceMap[$row->category_id] = $row->distance;
        }

        // N+1 방지: 카테고리 일괄 조회
        $categories = Category::query()
            ->whereIn('id', $categoryIds)
            ->get()
            ->keyBy('id');

        // 결과 매핑
        $recommendations = [];
        foreach ($categoryIds as $categoryId) {
            $category = $categories->get($categoryId);
            if ($category === null) {
                continue;
            }

            $nameField = match ($targetLanguage) {
                'zh' => 'category_name_zh',
                'en' => 'category_name_en',
                default => 'category_name_ko',
            };

            $recommendations[] = (object) [
                'category_code' => $category->category_code,
                'category_name' => $category->{$nameField},
                'similarity_score' => 1.0 - $distanceMap[$categoryId],
            ];
        }

        return response()->json(
            RecommendResource::collection($recommendations)
        );
    }
}
