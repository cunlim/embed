<?php

use App\Jobs\BatchTranslatePipeline;
use App\Models\Category;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Testing\Fakes\PendingBatchFake;

beforeEach(function () {
    Schema::create('categories', function (Blueprint $table) {
        $table->id();
        $table->string('category_code', 50);
        $table->string('category_name_ko', 255);
        $table->string('category_name_zh', 255)->nullable();
        $table->string('category_name_en', 255)->nullable();
        $table->timestamps();
    });

    config(['services.ollama.embedding_model' => 'bge-m3:latest']);
});

afterEach(function () {
    Schema::dropIfExists('categories');
});

test('BatchTranslatePipeline — 단일 언어 Job dispatch 성공', function () {
    Bus::fake();
    Category::factory()->count(3)->create();

    $pipeline = new BatchTranslatePipeline('zh');
    $pipeline->handle();

    Bus::assertBatchCount(1);
});

test('중복 BatchTranslatePipeline — 동일 언어 Lock으로 차단', function () {
    Bus::fake();
    Category::factory()->create();

    // 미리 락을 점유한다
    $lock = Cache::lock('translate-batch:en:bge-m3:latest', 600);
    $lock->get();

    $pipeline = new BatchTranslatePipeline('en');
    $pipeline->handle();

    Bus::assertBatchCount(0);

    $lock->release();
});

test('BatchTranslatePipeline — 100건 초과 시 여러 배치로 분할한다', function () {
    Bus::fake();
    for ($i = 0; $i < 101; $i++) {
        Category::factory()->create([
            'category_name_ko' => "카테고리-{$i}",
        ]);
    }

    $pipeline = new BatchTranslatePipeline('zh');
    $pipeline->handle();

    Bus::assertBatchCount(2);

    Bus::assertBatched(function (PendingBatchFake $batch) {
        return str_contains($batch->name, 'translate-embed-zh-chunk-')
            && count($batch->jobs) > 0;
    });
});
