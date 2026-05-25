<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RecommendResource extends JsonResource
{
    private static ?array $queryEmbedding = null;

    public static function setQueryEmbedding(?array $embedding): void
    {
        self::$queryEmbedding = $embedding;
    }

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
            'translation_status' => $this->translation_status,
            'similarity_score' => $this->similarity_score ?? null,
            'query_embedding' => self::$queryEmbedding,
            'category_embedding' => $this->parseCategoryEmbedding(),
            'per_language_scores' => $perLanguageScores,
        ];
    }

    private function parseCategoryEmbedding(): ?array
    {
        $raw = $this->category_embedding_raw ?? null;
        if ($raw === null) {
            return null;
        }
        if (is_array($raw)) {
            return $raw;
        }
        // pgvector raw select는 "[0.1,0.2,...]" 형식 문자열로 반환됨
        $decoded = json_decode((string) $raw, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        return null;
    }
}
