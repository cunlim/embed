<?php

namespace App\Services;

use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Models\SearchLog;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

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
     * pgvector JOIN pagination으로 유사도 검색 결과를 반환한다.
     * Category + CategoryEmbedding을 language로 JOIN하여 distance를 계산한다.
     *
     * @param  int|array<int>|null  $userId  단일 사용자 ID, 배열, 또는 null(제한 없음)
     */
    public function recommendPaginated(SearchLog $searchLog, string $targetLanguage, int $perPage = 20, int $page = 1, int|array|null $userId = null, ?string $keyword = null): LengthAwarePaginator
    {
        $embedding = $searchLog->embedding->toArray();
        $vectorLiteral = '['.implode(',', $embedding).']';

        $query = Category::select('categories.*')
            ->selectRaw('ce_ko.embedding <=> ?::vector as distance_ko', [$vectorLiteral])
            ->selectRaw('ce_en.embedding <=> ?::vector as distance_en', [$vectorLiteral])
            ->selectRaw('ce_zh.embedding <=> ?::vector as distance_zh', [$vectorLiteral])
            ->selectRaw("ce_{$targetLanguage}.embedding::text as category_embedding_raw")
            ->selectRaw('ce_ko.embedding::text as category_embedding_raw_ko')
            ->selectRaw('ce_en.embedding::text as category_embedding_raw_en')
            ->selectRaw('ce_zh.embedding::text as category_embedding_raw_zh')
            ->leftJoin('category_embeddings as ce_ko', function ($join) {
                $join->on('ce_ko.category_id', '=', 'categories.id')
                    ->where('ce_ko.language', '=', 'ko');
            })
            ->leftJoin('category_embeddings as ce_en', function ($join) {
                $join->on('ce_en.category_id', '=', 'categories.id')
                    ->where('ce_en.language', '=', 'en');
            })
            ->leftJoin('category_embeddings as ce_zh', function ($join) {
                $join->on('ce_zh.category_id', '=', 'categories.id')
                    ->where('ce_zh.language', '=', 'zh');
            });

        // rank 서브쿼리: user scope만 적용, keyword 필터 미적용
        foreach (['ko', 'en', 'zh'] as $lang) {
            $rankSub = DB::table('category_embeddings')
                ->select('category_embeddings.category_id')
                ->selectRaw(
                    'RANK() OVER (ORDER BY category_embeddings.embedding <=> ?::vector) as overall_rank',
                    [$vectorLiteral]
                )
                ->join('categories as rank_c', 'rank_c.id', '=', 'category_embeddings.category_id')
                ->where('category_embeddings.language', $lang);

            if ($userId !== null) {
                if (is_array($userId)) {
                    $rankSub->whereIn('rank_c.user_id', $userId);
                } else {
                    $rankSub->where('rank_c.user_id', $userId);
                }
            }

            $query->leftJoinSub($rankSub, "overall_ranks_{$lang}", "overall_ranks_{$lang}.category_id", '=', 'categories.id')
                ->selectRaw("overall_ranks_{$lang}.overall_rank as rank_{$lang}");
        }

        if ($userId !== null) {
            if (is_array($userId)) {
                $query->whereIn('categories.user_id', $userId);
            } else {
                $query->where('categories.user_id', $userId);
            }
        }

        if ($keyword) {
            $query->where('categories.category_name_ko', 'like', $keyword.'%');
        }

        $paginator = $query->orderByRaw("ce_{$targetLanguage}.embedding <=> ?::vector", [$vectorLiteral])
            ->paginate(perPage: $perPage, page: $page);

        $nameField = $this->nameFieldFor($targetLanguage);

        $items = $paginator->getCollection()->map(function (Category $category) use ($targetLanguage, $nameField) {
            // similarity_score는 targetLanguage 기준
            $dist = $category->{"distance_{$targetLanguage}"} ?? null;
            $category->similarity_score = $dist !== null
                ? round(1.0 - (float) $dist, 4)
                : null;
            $category->category_name = $category->{$nameField};

            // per-language scores 계산 (null이면 null)
            foreach (['ko', 'en', 'zh'] as $lang) {
                $dist = $category->{"distance_{$lang}"} ?? null;
                $category->{"similarity_score_{$lang}"} = $dist !== null
                    ? round(1.0 - (float) $dist, 4)
                    : null;
                $category->{"rank_{$lang}"} = $dist !== null
                    ? ($category->{"rank_{$lang}"} ?? null)
                    : null;
            }

            return $category;
        });
        $paginator->setCollection($items);

        return $paginator;
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
