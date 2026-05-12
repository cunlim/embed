<?php

use App\Events\AlreadyRunning;
use App\Jobs\BatchTranslatePipeline;
use App\Models\Category;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
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

test('락이 이미 점유되어 있으면 AlreadyRunning 이벤트를 발생시키고 배치를 생성하지 않는다', function () {
    Bus::fake();
    Event::fake([AlreadyRunning::class]);

    // 미리 락을 점유한다
    Cache::lock('translate-batch:en:bge-m3:latest', 600)->get();

    $pipeline = new BatchTranslatePipeline('en');
    $pipeline->handle();

    Event::assertDispatched(AlreadyRunning::class, function (AlreadyRunning $event) {
        return $event->language === 'en';
    });
    Bus::assertBatchCount(0);
});

test('카테고리가 없으면 Bus::batch를 dispatch하지 않는다', function () {
    Bus::fake();

    $pipeline = new BatchTranslatePipeline('en');
    $pipeline->handle();

    Bus::assertBatchCount(0);
});

test('락을 획득하고 카테고리가 있으면 Bus::batch로 dispatch한다', function () {
    Bus::fake();
    Category::factory()->count(3)->create();

    $pipeline = new BatchTranslatePipeline('zh');
    $pipeline->handle();

    Bus::assertBatchCount(1);
});

test('categoryIds를 지정하면 해당 카테고리만 처리한다', function () {
    Bus::fake();
    $cat1 = Category::factory()->create();
    $cat2 = Category::factory()->create();
    Category::factory()->create(); // 포함되지 않아야 함

    $pipeline = new BatchTranslatePipeline('en', [$cat1->id, $cat2->id]);
    $pipeline->handle();

    Bus::assertBatched(function (PendingBatchFake $batch) {
        return count($batch->jobs) === 2;
    });
});

test('100건을 초과하면 여러 batch로 분할한다', function () {
    Bus::fake();
    for ($i = 0; $i < 101; $i++) {
        Category::factory()->create([
            'category_name_ko' => "카테고리-{$i}",
        ]);
    }

    $pipeline = new BatchTranslatePipeline('ko');
    $pipeline->handle();

    // 101건 → ceil(101/100) = 2개 batch
    Bus::assertBatchCount(2);
});

test('categoryIds가 빈 배열이면 전체 카테고리를 처리한다', function () {
    Bus::fake();
    Category::factory()->count(3)->create();

    $pipeline = new BatchTranslatePipeline('en', []);
    $pipeline->handle();

    Bus::assertBatchCount(1);
});

test('배치 이름은 translate-embed-{언어} 형식이다', function () {
    Bus::fake();
    Category::factory()->create();

    $pipeline = new BatchTranslatePipeline('ko');
    $pipeline->handle();

    Bus::assertBatched(function (PendingBatchFake $batch) {
        return $batch->name === 'translate-embed-ko';
    });
});
