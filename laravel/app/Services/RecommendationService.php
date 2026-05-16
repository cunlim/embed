<?php

namespace App\Services;

use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Models\SearchLog;

class RecommendationService
{
    /**
     * 검색어 임베딩을 기반으로 유사한 카테고리를 추천한다.
     *
     * @return array<int, object{category_code: string, category_name: string, similarity_score: float}>
     */
    public function recommend(SearchLog $searchLog, string $targetLanguage, int $limit = 5): array
    {
        $embeddings = CategoryEmbedding::similarTo(
            $searchLog->embedding->toArray(), $targetLanguage, $limit
        )->get();

        $categoryIds = $embeddings->pluck('category_id')->all();

        $categories = Category::query()
            ->whereIn('id', $categoryIds)
            ->get()
            ->keyBy('id');

        $nameField = $this->nameFieldFor($targetLanguage);

        $recommendations = [];
        foreach ($embeddings as $embedding) {
            $category = $categories->get($embedding->category_id);
            if ($category === null) {
                continue;
            }

            $distance = $embedding->getAttribute('distance');

            $recommendations[] = (object) [
                'category_code' => $category->category_code,
                'category_name' => $category->{$nameField},
                'similarity_score' => round(1.0 - (float) $distance, 4),
            ];
        }

        return $recommendations;
    }

    /**
     * 대상 언어에 해당하는 카테고리명 컬럼명을 반환한다.
     */
    public function nameFieldFor(string $targetLanguage): string
    {
        return match ($targetLanguage) {
            'zh' => 'category_name_zh',
            'en' => 'category_name_en',
            default => 'category_name_ko',
        };
    }
}
