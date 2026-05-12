<?php

use App\Jobs\TranslateAndEmbedJob;
use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Services\EmbeddingGenerator;
use App\Services\OllamaTranslator;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Pgvector\Laravel\Vector;

beforeEach(function () {
    Schema::create('categories', function (Blueprint $table) {
        $table->id();
        $table->string('category_code', 50);
        $table->string('category_name_ko', 255);
        $table->string('category_name_zh', 255)->nullable();
        $table->string('category_name_en', 255)->nullable();
        $table->timestamps();
    });

    Schema::create('category_embeddings', function (Blueprint $table) {
        $table->id();
        $table->foreignId('category_id');
        $table->string('language', 10);
        $table->string('embed_model_name', 100);
        $table->text('embedding');
        $table->unique(['category_id', 'language', 'embed_model_name']);
        $table->timestamps();
    });

    Schema::create('translation_caches', function (Blueprint $table) {
        $table->id();
        $table->text('source_text');
        $table->string('target_lang', 10);
        $table->text('translated_text');
        $table->unique(['source_text', 'target_lang']);
        $table->timestamps();
    });

    config(['services.ollama.embedding_model' => 'bge-m3:latest']);
    config(['services.ollama.translation_model' => 'translategemma:4b']);
});

afterEach(function () {
    Schema::dropIfExists('category_embeddings');
    Schema::dropIfExists('categories');
    Schema::dropIfExists('translation_caches');
});

test('ko 언어는 원문 category_name_ko를 번역 없이 임베딩한다', function () {
    $category = Category::factory()->create(['category_name_ko' => '한국어카테고리']);

    $this->mock(OllamaTranslator::class, function ($mock) {
        $mock->shouldNotReceive('translate');
    });

    $this->mock(EmbeddingGenerator::class, function ($mock) {
        $mock->shouldReceive('generate')
            ->once()
            ->with('한국어카테고리')
            ->andReturn(array_fill(0, 1024, 0.1));
    });

    $job = new TranslateAndEmbedJob($category->id, 'ko');
    $job->handle(app(OllamaTranslator::class), app(EmbeddingGenerator::class));

    $embedding = CategoryEmbedding::query()
        ->where('category_id', $category->id)
        ->where('language', 'ko')
        ->first();

    expect($embedding)->not->toBeNull();
    expect($embedding->embed_model_name)->toBe('bge-m3:latest');
});

test('zh 언어는 번역 후 임베딩하고 번역 결과를 Category에 저장한다', function () {
    $category = Category::factory()->create(['category_name_ko' => '패션의류']);

    $this->mock(OllamaTranslator::class, function ($mock) {
        $mock->shouldReceive('translate')
            ->once()
            ->with('패션의류', 'zh')
            ->andReturn('时尚服装');
    });

    $this->mock(EmbeddingGenerator::class, function ($mock) {
        $mock->shouldReceive('generate')
            ->once()
            ->with('时尚服装')
            ->andReturn(array_fill(0, 1024, 0.2));
    });

    $job = new TranslateAndEmbedJob($category->id, 'zh');
    $job->handle(app(OllamaTranslator::class), app(EmbeddingGenerator::class));

    $category->refresh();
    expect($category->category_name_zh)->toBe('时尚服装');

    $embedding = CategoryEmbedding::query()
        ->where('category_id', $category->id)
        ->where('language', 'zh')
        ->first();
    expect($embedding)->not->toBeNull();
});

test('en 언어는 번역 후 임베딩하고 번역 결과를 Category에 저장한다', function () {
    $category = Category::factory()->create(['category_name_ko' => '패션의류']);

    $this->mock(OllamaTranslator::class, function ($mock) {
        $mock->shouldReceive('translate')
            ->once()
            ->with('패션의류', 'en')
            ->andReturn('Fashion Clothing');
    });

    $this->mock(EmbeddingGenerator::class, function ($mock) {
        $mock->shouldReceive('generate')
            ->once()
            ->with('Fashion Clothing')
            ->andReturn(array_fill(0, 1024, 0.3));
    });

    $job = new TranslateAndEmbedJob($category->id, 'en');
    $job->handle(app(OllamaTranslator::class), app(EmbeddingGenerator::class));

    $category->refresh();
    expect($category->category_name_en)->toBe('Fashion Clothing');
});

test('같은 카테고리+언어 조합이 이미 있으면 updateOrCreate로 갱신한다', function () {
    $category = Category::factory()->create(['category_name_ko' => '테스트']);

    $existing = new CategoryEmbedding;
    $existing->category_id = $category->id;
    $existing->language = 'ko';
    $existing->embed_model_name = 'bge-m3:latest';
    $existing->embedding = new Vector(array_fill(0, 1024, 0.0));
    $existing->save();

    $this->mock(OllamaTranslator::class, function ($mock) {
        $mock->shouldNotReceive('translate');
    });

    $newVector = array_fill(0, 1024, 0.5);
    $this->mock(EmbeddingGenerator::class, function ($mock) use ($newVector) {
        $mock->shouldReceive('generate')->once()->andReturn($newVector);
    });

    $job = new TranslateAndEmbedJob($category->id, 'ko');
    $job->handle(app(OllamaTranslator::class), app(EmbeddingGenerator::class));

    $count = CategoryEmbedding::query()
        ->where('category_id', $category->id)
        ->where('language', 'ko')
        ->count();
    expect($count)->toBe(1);
});

test('Ollama rate limit 예외 발생 시 임베딩을 생성하지 않는다', function () {
    $category = Category::factory()->create();

    $this->mock(OllamaTranslator::class, function ($mock) {
        $mock->shouldNotReceive('translate');
    });

    $this->mock(EmbeddingGenerator::class, function ($mock) {
        $mock->shouldReceive('generate')
            ->once()
            ->andThrow(new RuntimeException('Ollama rate limit exceeded'));
    });

    $job = new TranslateAndEmbedJob($category->id, 'ko');
    $job->handle(app(OllamaTranslator::class), app(EmbeddingGenerator::class));

    expect(CategoryEmbedding::query()->where('category_id', $category->id)->exists())->toBeFalse();
});

test('rate limit이 아닌 예외 발생 시 임베딩을 생성하지 않는다', function () {
    $category = Category::factory()->create();

    $this->mock(OllamaTranslator::class, function ($mock) {
        $mock->shouldNotReceive('translate');
    });

    $this->mock(EmbeddingGenerator::class, function ($mock) {
        $mock->shouldReceive('generate')
            ->once()
            ->andThrow(new RuntimeException('임베딩 생성 실패'));
    });

    $job = new TranslateAndEmbedJob($category->id, 'ko');
    $job->handle(app(OllamaTranslator::class), app(EmbeddingGenerator::class));

    expect(CategoryEmbedding::query()->where('category_id', $category->id)->exists())->toBeFalse();
});

test('존재하지 않는 카테고리 ID는 ModelNotFoundException을 던진다', function () {
    $this->mock(OllamaTranslator::class, function ($mock) {
        $mock->shouldNotReceive('translate');
    });
    $this->mock(EmbeddingGenerator::class, function ($mock) {
        $mock->shouldNotReceive('generate');
    });

    $job = new TranslateAndEmbedJob(99999, 'ko');

    expect(fn () => $job->handle(app(OllamaTranslator::class), app(EmbeddingGenerator::class)))
        ->toThrow(ModelNotFoundException::class);
});

test('지원하지 않는 언어 코드는 임베딩을 생성하지 않는다', function () {
    $category = Category::factory()->create();

    $this->mock(OllamaTranslator::class, function ($mock) {
        $mock->shouldNotReceive('translate');
    });
    $this->mock(EmbeddingGenerator::class, function ($mock) {
        $mock->shouldNotReceive('generate');
    });

    $job = new TranslateAndEmbedJob($category->id, 'ja');
    $job->handle(app(OllamaTranslator::class), app(EmbeddingGenerator::class));

    expect(CategoryEmbedding::query()->where('category_id', $category->id)->exists())->toBeFalse();
});
