<?php

namespace App\Http\Resources;

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
        ];
    }
}
