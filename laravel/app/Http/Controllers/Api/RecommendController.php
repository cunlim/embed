<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RecommendRequest;
use App\Http\Resources\RecommendResource;
use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Services\EmbeddingCacheService;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

class RecommendController extends Controller
{
    public function __construct(
        private EmbeddingCacheService $embeddingCache,
    ) {}

    public function recommend(RecommendRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $text = $validated["text"];
        $targetLanguage = $validated["target_language"];

        $sessionId = $request->session()->getId();
        $userId = auth()->id();
        $modelName = config("services.ollama.embedding_model", "bge-m3:latest");

        $searchLog = $this->embeddingCache->getOrCreateEmbedding(
            $text, $modelName, $userId, $sessionId
        );

        $embeddings = CategoryEmbedding::similarTo(
            $searchLog->embedding->toArray(), $targetLanguage, 5
        )->get();

        $categoryIds = $embeddings->pluck("category_id")->all();

        $categories = Category::query()
            ->whereIn("id", $categoryIds)
            ->get()
            ->keyBy("id");

        $recommendations = [];
        foreach ($embeddings as $embedding) {
            $category = $categories->get($embedding->category_id);
            if ($category === null) {
                continue;
            }

            $nameField = match ($targetLanguage) {
                "zh" => "category_name_zh",
                "en" => "category_name_en",
                default => "category_name_ko",
            };

            $distance = $embedding->getAttribute("distance");

            $recommendations[] = (object) [
                "category_code" => $category->category_code,
                "category_name" => $category->{$nameField},
                "similarity_score" => 1.0 - (float) $distance,
            ];
        }

        return RecommendResource::collection($recommendations)->response();
    }
}
