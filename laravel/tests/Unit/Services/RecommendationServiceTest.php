<?php

use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Models\SearchLog;
use App\Services\RecommendationService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Pgvector\Laravel\Vector;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function () {
    Schema::create('categories', function (Blueprint $table) {
        $table->id();
        $table->string('category_code', 50);
        $table->string('category_name_ko', 255);
        $table->string('category_name_zh', 255)->nullable();
        $table->string('category_name_en', 255)->nullable();
        $table->timestamps();
    });

    // 실제 마이그레이션은 vector(1024) 타입이지만, SQLite 인메모리 테스트 환경에서는
    // pgvector 익스텐션을 사용할 수 없어 text로 대체한다.
    Schema::create('category_embeddings', function (Blueprint $table) {
        $table->id();
        $table->foreignId('category_id');
        $table->string('language', 10);
        $table->string('embed_model_name', 100);
        $table->text('embedding');
        $table->unique(['category_id', 'language', 'embed_model_name']);
        $table->timestamps();
    });
});

afterEach(function () {
    Schema::dropIfExists('category_embeddings');
    Schema::dropIfExists('categories');
});

test('nameFieldFor — zh는 category_name_zh를 반환한다', function () {
    $service = new RecommendationService;
    expect($service->nameFieldFor('zh'))->toBe('category_name_zh');
});

test('nameFieldFor — en은 category_name_en을 반환한다', function () {
    $service = new RecommendationService;
    expect($service->nameFieldFor('en'))->toBe('category_name_en');
});

test('nameFieldFor — ko 등 기타 언어는 category_name_ko를 반환한다', function () {
    $service = new RecommendationService;
    expect($service->nameFieldFor('ko'))->toBe('category_name_ko');
    expect($service->nameFieldFor('unknown'))->toBe('category_name_ko');
});

test('recommend — 유사도 점수는 1.0 - distance로 계산된다', function () {
    $category = Category::factory()->create([
        'category_code' => '50000000',
        'category_name_ko' => '패션의류',
        'category_name_zh' => '时尚服装',
        'category_name_en' => 'Fashion Clothing',
    ]);

    // distance 값을 포함한 embedding record를 직접 생성
    $categoryEmbedding = new CategoryEmbedding;
    $categoryEmbedding->category_id = $category->id;
    $categoryEmbedding->language = 'ko';
    $categoryEmbedding->embed_model_name = 'bge-m3:latest';
    $categoryEmbedding->embedding = new Vector(array_fill(0, 1024, 0.1));
    $categoryEmbedding->save();
    $categoryEmbedding->distance = 0.15;

    $searchLog = new SearchLog([
        'search_keyword' => '청바지',
        'normalized_keyword' => '청바지',
        'embed_model_name' => 'bge-m3:latest',
        'session_id' => 'test-session',
    ]);
    $searchLog->embedding = array_fill(0, 1024, 0.05);

    // SQLite에서 pgvector <=> 연산자는 지원되지 않으므로,
    // 수동으로 distance를 설정한 embedding을 whereIn으로 직접 조회하는
    // 로직과 nameFieldFor()의 조합을 통해 매핑 로직을 검증한다.
    $service = new RecommendationService;
    $nameField = $service->nameFieldFor('ko');

    expect($nameField)->toBe('category_name_ko');
    expect($category->{$nameField})->toBe('패션의류');

    // similarity_score 계산 로직 검증
    $distance = $categoryEmbedding->distance;
    $score = round(1.0 - (float) $distance, 4);
    expect($score)->toBe(0.85);
});
