<?php

namespace App\Http\Resources;

use App\Models\CategoryEmbedding;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RecommendResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $lang = $request->input('target_language', 'ko');

        $perLanguageScores = [];
        foreach (['ko', 'en', 'zh'] as $l) {
            $score = $this->{"similarity_score_{$l}"} ?? null;
            $perLanguageScores[$l] = [
                'similarity_score' => $score,
                'rank' => $this->{"rank_{$l}"} ?? null,
            ];
        }

        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'category_code' => $this->category_code,
            'category_name_ko' => $this->category_name_ko,
            'category_name_zh' => $this->category_name_zh,
            'category_name_en' => $this->category_name_en,
            'category_name' => $this->{"category_name_{$lang}"},
            'translation_status' => $this->translationStatus(),
            'similarity_score' => $this->similarity_score ?? null,
            'per_language_scores' => $perLanguageScores,
        ];
    }

    private function translationStatus(): string
    {
        $hasZh = $this->category_name_zh !== null;
        $hasEn = $this->category_name_en !== null;

        $embeddings = $this->relationLoaded('embeddings')
            ? $this->embeddings->pluck('language')->toArray()
            : CategoryEmbedding::query()->where('category_id', $this->id)->pluck('language')->toArray();

        $hasKoEmb = in_array('ko', $embeddings);
        $hasZhEmb = in_array('zh', $embeddings);
        $hasEnEmb = in_array('en', $embeddings);

        $allDone = $hasZh && $hasEn && $hasKoEmb && $hasZhEmb && $hasEnEmb;
        $noneDone = ! $hasZh && ! $hasEn && ! $hasKoEmb && ! $hasZhEmb && ! $hasEnEmb;

        if ($allDone) {
            return 'completed';
        }
        if ($noneDone) {
            return 'pending';
        }

        return 'partial';
    }
}
