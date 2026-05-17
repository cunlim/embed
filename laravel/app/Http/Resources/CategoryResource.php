<?php

namespace App\Http\Resources;

use App\Models\CategoryEmbedding;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CategoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category_code' => $this->category_code,
            'category_name_ko' => $this->category_name_ko,
            'category_name_zh' => $this->category_name_zh,
            'category_name_en' => $this->category_name_en,
            'translation_status' => $this->translationStatus(),
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
