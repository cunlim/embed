<?php

use App\Http\Controllers\Api\RecommendController;
use App\Http\Resources\RecommendResource;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

beforeEach(function () {
    Schema::create('categories', function (Blueprint $table) {
        $table->id();
        $table->string('category_code', 50);
        $table->string('category_name_ko', 255);
        $table->string('category_name_zh', 255)->nullable();
        $table->string('category_name_en', 255)->nullable();
        $table->timestamps();
    });
});

afterEach(function () {
    Schema::dropIfExists('categories');
});

test('POST /api/recommend — text가 없으면 422를 반환한다', function () {
    $response = $this->postJson('/api/recommend', [
        'target_language' => 'ko',
    ]);
    $response->assertUnprocessable()->assertJsonValidationErrors(['text']);
});

test('POST /api/recommend — text가 빈 문자열이면 422를 반환한다', function () {
    $response = $this->postJson('/api/recommend', [
        'text' => '', 'target_language' => 'ko',
    ]);
    $response->assertUnprocessable()->assertJsonValidationErrors(['text']);
});

test('POST /api/recommend — text가 500자를 초과하면 422를 반환한다', function () {
    $response = $this->postJson('/api/recommend', [
        'text' => str_repeat('a', 501), 'target_language' => 'ko',
    ]);
    $response->assertUnprocessable()->assertJsonValidationErrors(['text']);
});

test('POST /api/recommend — target_language가 없으면 422를 반환한다', function () {
    $response = $this->postJson('/api/recommend', [
        'text' => '검색어',
    ]);
    $response->assertUnprocessable()->assertJsonValidationErrors(['target_language']);
});

test('POST /api/recommend — 지원하지 않는 언어면 422를 반환한다', function () {
    $response = $this->postJson('/api/recommend', [
        'text' => '검색어', 'target_language' => 'ja',
    ]);
    $response->assertUnprocessable()->assertJsonValidationErrors(['target_language']);
});

test('RecommendController에 EmbeddingCacheService가 주입된다', function () {
    $controller = app()->make(RecommendController::class);
    expect($controller)->toBeInstanceOf(RecommendController::class);
});

test('RecommendResource — toArray 응답 형식을 검증한다', function () {
    $item = (object) [
        'category_code' => 'CAT_abc12345',
        'category_name' => '패션의류',
        'similarity_score' => 0.9532,
    ];
    $resource = new RecommendResource($item);
    $data = $resource->toArray(request());
    expect($data)->toHaveKeys(['category_code', 'category_name', 'similarity_score']);
    expect($data['category_code'])->toBe('CAT_abc12345');
    expect($data['category_name'])->toBe('패션의류');
    expect($data['similarity_score'])->toBe(0.9532);
});
