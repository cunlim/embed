<?php

namespace App\Jobs;

use App\Events\BatchCompleted;
use App\Events\BatchFailed;
use App\Events\TranslationProgress;
use App\Models\Category;
use Illuminate\Bus\Batch;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Bus;
use Throwable;

class BatchTranslatePipeline implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        private string $targetLanguage,
        private ?array $categoryIds = null,
    ) {}

    public function handle(): void
    {
        $categories = $this->categoryIds !== null
            ? Category::query()->whereIn('id', $this->categoryIds)->get()
            : Category::query()->get();

        if ($categories->isEmpty()) {
            return;
        }

        $chunks = $categories->chunk(100);

        foreach ($chunks as $chunk) {
            $jobs = $chunk->map(fn (Category $category) => new TranslateAndEmbedJob(
                $category->id,
                $this->targetLanguage,
            ))->all();

            Bus::batch($jobs)
                ->name("translate-embed-{$this->targetLanguage}")
                ->allowFailures()
                ->progress(function (Batch $batch) {
                    TranslationProgress::dispatch(
                        $batch->id,
                        $batch->totalJobs,
                        $batch->processedJobs(),
                        $batch->failedJobs,
                        'processing',
                    );
                })
                ->then(function (Batch $batch) {
                    BatchCompleted::dispatch($batch->id);
                })
                ->catch(function (Batch $batch, Throwable $e) {
                    BatchFailed::dispatch($batch->id, $e->getMessage());
                })
                ->dispatch();
        }
    }
}
