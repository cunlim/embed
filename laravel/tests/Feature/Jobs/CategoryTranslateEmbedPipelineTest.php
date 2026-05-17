<?php

use App\Events\CategoryPipelineCompleted;
use App\Events\CategoryProgress;
use App\Jobs\CategoryTranslateEmbedPipeline;
use App\Models\Category;
use App\Services\EmbeddingGenerator;
use App\Services\OllamaTranslator;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake([CategoryProgress::class, CategoryPipelineCompleted::class]);
    config(['services.ollama.embedding_model' => 'bge-m3:latest']);
});

test('lock이 이미 점유되어 있으면 아무 이벤트도 dispatch하지 않는다', function () {
    Category::factory()->create();
    Cache::lock('category-translate:1', 600)->get();

    $job = new CategoryTranslateEmbedPipeline(1);
    $job->handle(app(OllamaTranslator::class), app(EmbeddingGenerator::class));

    Event::assertNothingDispatched();
});

test('카테고리가 없으면 ModelNotFoundException 발생', function () {
    $job = new CategoryTranslateEmbedPipeline(999);

    $job->handle(app(OllamaTranslator::class), app(EmbeddingGenerator::class));
})->throws(ModelNotFoundException::class);

test('5단계 순서대로 진행 이벤트를 broadcast 한다', function () {
    $category = Category::factory()->create();
    $translator = mock(OllamaTranslator::class);
    $embedder = mock(EmbeddingGenerator::class);

    $translator->shouldReceive('translate')
        ->times(2)
        ->andReturn('번역됨');
    $embedder->shouldReceive('generate')
        ->times(3)
        ->andReturn(array_fill(0, 1024, 0.01));

    $job = new CategoryTranslateEmbedPipeline($category->id);
    $job->handle($translator, $embedder);

    Event::assertDispatched(CategoryProgress::class, 10); // running + completed for 5 steps

    $expectedSteps = [
        ['stepName' => 'translation.zh', 'step' => 1],
        ['stepName' => 'translation.en', 'step' => 2],
        ['stepName' => 'embedding.ko', 'step' => 3],
        ['stepName' => 'embedding.zh', 'step' => 4],
        ['stepName' => 'embedding.en', 'step' => 5],
    ];

    foreach ($expectedSteps as $i => $expected) {
        Event::assertDispatched(CategoryProgress::class, function (CategoryProgress $event) use ($expected) {
            return $event->stepName === $expected['stepName']
                && $event->step === $expected['step']
                && $event->status === 'running';
        });
        Event::assertDispatched(CategoryProgress::class, function (CategoryProgress $event) use ($expected) {
            $isCompleted = $event->stepName === $expected['stepName']
                && $event->step === $expected['step']
                && $event->status === 'completed';

            if ($isCompleted) {
                if (str_starts_with($expected['stepName'], 'translation')) {
                    return $event->result === '번역됨';
                }
                // embedding: result는 첫 10개 값의 JSON 배열
                $parsed = json_decode($event->result, true);

                return is_array($parsed) && count($parsed) === 10;
            }

            return false;
        });
    }
});

test('완료 후 CategoryPipelineCompleted 이벤트를 broadcast 한다', function () {
    $category = Category::factory()->create();
    $translator = mock(OllamaTranslator::class);
    $embedder = mock(EmbeddingGenerator::class);

    $translator->shouldReceive('translate')->andReturn('번역됨');
    $embedder->shouldReceive('generate')->andReturn(array_fill(0, 1024, 0.01));

    $job = new CategoryTranslateEmbedPipeline($category->id);
    $job->handle($translator, $embedder);

    Event::assertDispatched(CategoryPipelineCompleted::class, function (CategoryPipelineCompleted $event) use ($category) {
        return $event->categoryId === $category->id
            && $event->allSuccess === true
            && $event->failedStep === 0;
    });
});

test('단계 실패 시 이후 단계로 진행하지 않고 CategoryProgress failed 이벤트를 발생시킨다', function () {
    $category = Category::factory()->create();
    $translator = mock(OllamaTranslator::class);
    $embedder = mock(EmbeddingGenerator::class);

    $translator->shouldReceive('translate')
        ->once()
        ->andThrow(new RuntimeException('Ollama rate limit exceeded'));

    $job = new CategoryTranslateEmbedPipeline($category->id);
    $job->handle($translator, $embedder);

    // translation.zh running + failed: 2회
    Event::assertDispatched(CategoryProgress::class, function (CategoryProgress $event) {
        return $event->step === 1 && $event->status === 'running';
    });
    Event::assertDispatched(CategoryProgress::class, function (CategoryProgress $event) {
        return $event->step === 1 && $event->status === 'failed'
            && $event->error === 'Ollama rate limit exceeded';
    });
    // 이후 단계는 dispatch되지 않음
    Event::assertNotDispatched(CategoryProgress::class, function (CategoryProgress $event) {
        return $event->step >= 2 && $event->status === 'running';
    });
    // 완료 이벤트는 실패 정보 포함
    Event::assertDispatched(CategoryPipelineCompleted::class, function (CategoryPipelineCompleted $event) {
        return $event->allSuccess === false && $event->failedStep === 1;
    });
});

test('cancel flag가 설정되어 있으면 다음 단계 전에 중단한다', function () {
    $category = Category::factory()->create();
    $translator = mock(OllamaTranslator::class);
    $embedder = mock(EmbeddingGenerator::class);

    $translator->shouldReceive('translate')
        ->times(2)
        ->andReturn('번역됨');

    // 첫 번째 임베딩 실행 중 cancel flag 설정
    $embedder->shouldReceive('generate')
        ->once()
        ->andReturnUsing(function () use ($category) {
            Cache::put("category-translate-cancel:{$category->id}", true, 600);

            return array_fill(0, 1024, 0.01);
        });

    $job = new CategoryTranslateEmbedPipeline($category->id);
    $job->handle($translator, $embedder);

    // 첫 번째 임베딩은 실행되지만, 이후 단계 전 cancel flag 확인 후 중단
    Event::assertDispatched(CategoryPipelineCompleted::class, function (CategoryPipelineCompleted $event) {
        return $event->allSuccess === false;
    });
});

test('이미 완료된 단계는 건너뛴다 (smart resume)', function () {
    $category = Category::factory()->create([
        'category_name_zh' => '이미 번역됨',
        'category_name_en' => 'already translated',
    ]);
    $translator = mock(OllamaTranslator::class);
    $embedder = mock(EmbeddingGenerator::class);

    // 번역은 이미 완료되었으므로 translate() 호출 없음
    $translator->shouldReceive('translate')->never();
    // 임베딩만 3회 실행
    $embedder->shouldReceive('generate')
        ->times(3)
        ->andReturn(array_fill(0, 1024, 0.01));

    $job = new CategoryTranslateEmbedPipeline($category->id);
    $job->handle($translator, $embedder);

    // translation.zh, translation.en은 completed로 즉시 broadcast
    Event::assertDispatched(CategoryProgress::class, function (CategoryProgress $event) {
        return $event->stepName === 'translation.zh' && $event->status === 'completed';
    });
    Event::assertDispatched(CategoryProgress::class, function (CategoryProgress $event) {
        return $event->stepName === 'translation.en' && $event->status === 'completed';
    });
});

test('onlySteps가 null이면 전체 5단계를 실행한다 (하위 호환)', function () {
    $category = Category::factory()->create();
    $translator = mock(OllamaTranslator::class);
    $embedder = mock(EmbeddingGenerator::class);

    $translator->shouldReceive('translate')
        ->times(2)
        ->andReturn('번역됨');
    $embedder->shouldReceive('generate')
        ->times(3)
        ->andReturn(array_fill(0, 1024, 0.01));

    $job = new CategoryTranslateEmbedPipeline($category->id, null);
    $job->handle($translator, $embedder);

    Event::assertDispatched(CategoryProgress::class, 10); // running + completed for 5 steps
    Event::assertDispatched(CategoryPipelineCompleted::class, function (CategoryPipelineCompleted $event) {
        return $event->allSuccess === true && $event->failedStep === 0;
    });
});

test('onlySteps가 지정되면 해당 단계만 실행하고 step 번호를 1부터 다시 매긴다', function () {
    $category = Category::factory()->create([
        'category_name_en' => 'pre-translated',
    ]);
    $translator = mock(OllamaTranslator::class);
    $embedder = mock(EmbeddingGenerator::class);

    // translation은 호출되지 않고 embedding.ko, embedding.en만 호출
    $translator->shouldReceive('translate')->never();
    $embedder->shouldReceive('generate')
        ->times(2)
        ->andReturn(array_fill(0, 1024, 0.01));

    $job = new CategoryTranslateEmbedPipeline($category->id, ['embedding.ko', 'embedding.en']);
    $job->handle($translator, $embedder);

    // running + completed for 2 steps = 4회
    Event::assertDispatched(CategoryProgress::class, 4);

    // embedding.ko → step 1, embedding.en → step 2 로 재매김
    Event::assertDispatched(CategoryProgress::class, function (CategoryProgress $event) {
        return $event->stepName === 'embedding.ko' && $event->step === 1 && $event->status === 'running';
    });
    Event::assertDispatched(CategoryProgress::class, function (CategoryProgress $event) {
        return $event->stepName === 'embedding.ko' && $event->step === 1 && $event->status === 'completed';
    });
    Event::assertDispatched(CategoryProgress::class, function (CategoryProgress $event) {
        return $event->stepName === 'embedding.en' && $event->step === 2 && $event->status === 'running';
    });
    Event::assertDispatched(CategoryProgress::class, function (CategoryProgress $event) {
        return $event->stepName === 'embedding.en' && $event->step === 2 && $event->status === 'completed';
    });
});
