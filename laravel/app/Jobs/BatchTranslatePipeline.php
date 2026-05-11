<?php

namespace App\Jobs;

use App\Models\Category;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Bus;

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
                ->dispatch();
        }
    }
}
