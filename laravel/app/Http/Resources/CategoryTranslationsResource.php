<?php

namespace App\Http\Resources;

use App\Models\CategoryEmbedding;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CategoryTranslationsResource extends JsonResource
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
            'embedding_dimensions' => $this->embeddingDimensions(),
            'languages' => [
                'ko' => $this->languageData('ko', false),
                'en' => $this->languageData('en', true),
                'zh' => $this->languageData('zh', true),
            ],
        ];
    }

    private function languageData(string $lang, bool $needsTranslation): array
    {
        $translationText = $needsTranslation
            ? $this->{'category_name_'.$lang}
            : $this->category_name_ko;

        return [
            'translation_text' => $translationText,
            'embedding' => $this->embeddingData($lang),
        ];
    }

    private function embeddingData(string $lang): array
    {
        $emb = $this->findEmbedding($lang);

        if (! $emb || ! $emb->embedding) {
            return request()->boolean('no_preview')
                ? ['status' => 'pending']
                : ['status' => 'pending', 'preview' => null];
        }

        if (request()->boolean('no_preview')) {
            return ['status' => 'completed'];
        }

        $vector = $emb->embedding->toArray();

        return [
            'status' => 'completed',
            'preview' => $vector !== [] ? array_map(fn ($v) => (float) $v, $vector) : null,
        ];
    }

    private function findEmbedding(string $lang): ?CategoryEmbedding
    {
        if ($this->relationLoaded('embeddings')) {
            $emb = $this->embeddings->firstWhere('language', $lang);

            return $emb instanceof CategoryEmbedding ? $emb : null;
        }

        return CategoryEmbedding::query()
            ->where('category_id', $this->id)
            ->where('language', $lang)
            ->first();
    }

    private function embeddingDimensions(): ?int
    {
        if ($this->relationLoaded('embeddings')) {
            $emb = $this->embeddings->first(fn (CategoryEmbedding $e) => $e->embedding !== null);
        } else {
            $emb = CategoryEmbedding::query()
                ->where('category_id', $this->id)
                ->whereNotNull('embedding')
                ->first();
        }

        if (! $emb || ! $emb->embedding) {
            return null;
        }

        $vector = $emb->embedding->toArray();

        return $vector !== [] ? count($vector) : null;
    }
}
