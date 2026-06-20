<?php

use App\Http\Resources\RecommendResource;
use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('RecommendResource includes per_language_scores without embedding vectors', function () {
    $user = User::factory()->create();
    $category = Category::factory()->create(['user_id' => $user->id]);

    $embedding = array_fill(0, 1024, 0.1);
    CategoryEmbedding::factory()->create([
        'category_id' => $category->id,
        'language' => 'ko',
        'embedding' => $embedding,
    ]);
    CategoryEmbedding::factory()->create([
        'category_id' => $category->id,
        'language' => 'en',
        'embedding' => $embedding,
    ]);
    CategoryEmbedding::factory()->create([
        'category_id' => $category->id,
        'language' => 'zh',
        'embedding' => $embedding,
    ]);

    $category->similarity_score = 0.9876;
    $category->similarity_score_ko = 0.9876;
    $category->similarity_score_en = 0.8210;
    $category->similarity_score_zh = 0.7950;
    $category->rank_ko = 1;
    $category->rank_en = 2;
    $category->rank_zh = 3;

    $resource = new RecommendResource($category);
    $data = $resource->resolve(request()->merge(['target_language' => 'ko']));

    // 임베딩 벡터 필드가 포함되지 않음
    expect($data)->not->toHaveKey('query_embedding');
    expect($data)->not->toHaveKey('category_embedding');

    expect($data)->toHaveKey('per_language_scores');
    expect($data['per_language_scores'])->toBeArray();
    expect($data['per_language_scores']['ko'])->toMatchArray([
        'similarity_score' => 0.9876,
        'rank' => 1,
    ]);
    expect($data['per_language_scores']['en'])->toMatchArray([
        'similarity_score' => 0.8210,
        'rank' => 2,
    ]);
    expect($data['per_language_scores']['zh'])->toMatchArray([
        'similarity_score' => 0.7950,
        'rank' => 3,
    ]);
    // per_language_scores에서도 category_embedding이 없음
    expect($data['per_language_scores']['ko'])->not->toHaveKey('category_embedding');
});
