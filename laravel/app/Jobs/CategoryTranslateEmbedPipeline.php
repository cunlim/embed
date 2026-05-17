<?php

namespace App\Jobs;

use App\Events\CategoryPipelineCompleted;
use App\Events\CategoryProgress;
use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Services\EmbeddingGenerator;
use App\Services\OllamaTranslator;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use RuntimeException;

class CategoryTranslateEmbedPipeline implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Ollama cold start 및 과부하를 감안한 넉넉한 타임아웃 */
    public int $timeout = 600;

    /** Rate Limit 재시도 포함 최대 5회 */
    public int $tries = 5;

    public function __construct(
        private int $categoryId,
        private ?array $onlySteps = null,
    ) {}

    public function handle(
        OllamaTranslator $translator,
        EmbeddingGenerator $embedder
    ): void {
        $lockKey = "category-translate:{$this->categoryId}";

        $lock = Cache::lock($lockKey, 600);

        if (! $lock->get()) {
            return;
        }

        try {
            $category = Category::query()->findOrFail($this->categoryId);

            $categoryNameKo = $category->category_name_ko;
            $embedModelName = config('services.ollama.embedding_model');

            // 5단계 정의
            $allSteps = [
                ['step' => 1, 'name' => 'translation.zh', 'language' => 'zh', 'type' => 'translation'],
                ['step' => 2, 'name' => 'translation.en', 'language' => 'en', 'type' => 'translation'],
                ['step' => 3, 'name' => 'embedding.ko', 'language' => 'ko', 'type' => 'embedding'],
                ['step' => 4, 'name' => 'embedding.zh', 'language' => 'zh', 'type' => 'embedding'],
                ['step' => 5, 'name' => 'embedding.en', 'language' => 'en', 'type' => 'embedding'],
            ];

            $steps = $this->onlySteps !== null
                ? array_values(array_map(fn ($s, $i) => [...$s, 'step' => $i + 1], $filtered = array_values(array_filter($allSteps, fn ($s) => in_array($s['name'], $this->onlySteps, true))), array_keys($filtered)))
                : $allSteps;

            $failedStep = 0;
            $cancelled = false;

            foreach ($steps as $stepDef) {
                // cancel flag 확인
                if (Cache::get("category-translate-cancel:{$this->categoryId}")) {
                    $cancelled = true;
                    break;
                }

                // smart resume: 이미 완료된 단계 건너뛰기
                if ($this->isStepCompleted($category, $stepDef)) {
                    CategoryProgress::dispatch(
                        $this->categoryId,
                        $stepDef['step'],
                        $stepDef['name'],
                        'completed',
                    );

                    continue;
                }

                // 단계 시작 broadcast
                CategoryProgress::dispatch(
                    $this->categoryId,
                    $stepDef['step'],
                    $stepDef['name'],
                    'running',
                );

                try {
                    if ($stepDef['type'] === 'translation') {
                        $column = $stepDef['language'] === 'zh' ? 'category_name_zh' : 'category_name_en';
                        $translated = $translator->translate($categoryNameKo, $stepDef['language']);
                        $category->{$column} = $translated;
                        $category->save();

                        // 단계 완료 broadcast + 번역 결과
                        CategoryProgress::dispatch(
                            $this->categoryId,
                            $stepDef['step'],
                            $stepDef['name'],
                            'completed',
                            null,
                            $translated,
                        );
                    } else {
                        $textForEmbedding = match ($stepDef['language']) {
                            'ko' => $category->category_name_ko,
                            'zh' => $category->category_name_zh,
                            'en' => $category->category_name_en,
                        };

                        $vector = $embedder->generate($textForEmbedding);

                        CategoryEmbedding::updateOrCreate(
                            [
                                'category_id' => $this->categoryId,
                                'language' => $stepDef['language'],
                                'embed_model_name' => $embedModelName,
                            ],
                            [
                                'embedding' => $vector,
                            ]
                        );

                        // 단계 완료 broadcast + 임베딩 preview (첫 10개 값)
                        CategoryProgress::dispatch(
                            $this->categoryId,
                            $stepDef['step'],
                            $stepDef['name'],
                            'completed',
                            null,
                            json_encode(array_slice($vector, 0, 10)),
                        );
                    }
                } catch (RuntimeException $e) {
                    $failedStep = $stepDef['step'];
                    $errorMsg = $e->getMessage();

                    // 민감 정보 제거
                    if (str_contains($errorMsg, 'Ollama rate limit exceeded')) {
                        $errorMsg = 'Ollama rate limit exceeded';
                    }

                    CategoryProgress::dispatch(
                        $this->categoryId,
                        $stepDef['step'],
                        $stepDef['name'],
                        'failed',
                        $errorMsg,
                    );

                    break;
                }
            }

            CategoryPipelineCompleted::dispatch(
                $this->categoryId,
                $failedStep === 0 && ! $cancelled,
                $failedStep,
            );
        } finally {
            Cache::forget("category-translate-cancel:{$this->categoryId}");
            $lock->release();
        }
    }

    /**
     * 해당 단계가 이미 완료되었는지 DB 상태로 확인한다.
     */
    private function isStepCompleted(Category $category, array $stepDef): bool
    {
        if ($stepDef['type'] === 'translation') {
            $column = $stepDef['language'] === 'zh' ? 'category_name_zh' : 'category_name_en';

            return $category->{$column} !== null;
        }

        // embedding
        return CategoryEmbedding::query()
            ->where('category_id', $this->categoryId)
            ->where('language', $stepDef['language'])
            ->exists();
    }
}
