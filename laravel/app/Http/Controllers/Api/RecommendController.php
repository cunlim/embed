<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RecommendRequest;
use App\Http\Resources\RecommendResource;
use App\Models\Category;
use App\Services\EmbeddingGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class RecommendController extends Controller
{
    public function __construct(
        private EmbeddingGenerator $embeddingGenerator
    ) {}

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
