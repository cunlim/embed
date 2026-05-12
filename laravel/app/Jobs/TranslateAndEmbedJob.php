<?php

namespace App\Jobs;

use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Services\EmbeddingGenerator;
use App\Services\OllamaTranslator;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use RuntimeException;

class TranslateAndEmbedJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Ollama cold start 및 과부하를 감안한 넉넉한 타임아웃 */
    public int $timeout = 600;

    /** Rate Limit 재시도 포함 최대 5회 */
    public int $tries = 5;

    public function __construct(
        private int $categoryId,
        private string $targetLanguage, // 'ko' | 'zh' | 'en' — 단일 언어
    ) {}

    public function handle(
        OllamaTranslator $translator,
        EmbeddingGenerator $embedder
    ): void {
        $category = Category::query()->findOrFail($this->categoryId);

        try {
            $textForEmbedding = $this->resolveText($category, $translator);
            $vector = $embedder->generate($textForEmbedding);

            CategoryEmbedding::updateOrCreate(
                [
                    'category_id' => $this->categoryId,
                    'language' => $this->targetLanguage,
                    'embed_model_name' => config('services.ollama.embedding_model', 'bge-m3:latest'),
                ],
                [
                    'embedding' => $vector,
                ]
            );
        } catch (RuntimeException $e) {
            if (str_contains($e->getMessage(), 'Ollama rate limit exceeded')) {
                $this->release(120);

                return;
            }

            $this->fail($e);
        }
    }

    /**
     * 임베딩에 사용할 텍스트를 언어별로 결정하고, 필요한 경우 번역을 수행한다.
     */
    private function resolveText(Category $category, OllamaTranslator $translator): string
    {
        return match ($this->targetLanguage) {
            'ko' => $category->category_name_ko,
            'zh' => $this->translateAndSave($category, $translator, 'zh', 'category_name_zh'),
            'en' => $this->translateAndSave($category, $translator, 'en', 'category_name_en'),
            default => throw new RuntimeException("지원하지 않는 언어: {$this->targetLanguage}"),
        };
    }

    /**
     * 번역을 수행하고 결과를 Category 모델에 저장한 뒤 반환한다.
     */
    private function translateAndSave(Category $category, OllamaTranslator $translator, string $lang, string $column): string
    {
        $translated = $translator->translate($category->category_name_ko, $lang);
        $category->{$column} = $translated;
        $category->save();

        return $translated;
    }
}
