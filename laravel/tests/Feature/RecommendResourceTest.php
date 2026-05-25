<?php

use App\Http\Resources\RecommendResource;
use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('RecommendResource includes per_language_scores', function () {
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

    RecommendResource::setQueryEmbedding($embedding);
    RecommendResource::setPageOffset(1, 20);
    RecommendResource::setTargetLanguage('ko');

    $category->similarity_score = 0.9876;
    $category->similarity_score_ko = 0.9876;
    $category->similarity_score_en = 0.8210;
    $category->similarity_score_zh = 0.7950;
    $category->collection_index = 0;

    $resource = new RecommendResource($category);
    $data = $resource->resolve(request()->merge(['target_language' => 'ko']));

    expect($data)->toHaveKey('per_language_scores');
    expect($data['per_language_scores'])->toBeArray();
    expect($data['per_language_scores']['ko'])->toMatchArray([
        'similarity_score' => 0.9876,
        'rank' => 1,
    ]);
    expect($data['per_language_scores']['en'])->toMatchArray([
        'similarity_score' => 0.8210,
        'rank' => 1,
    ]);
});
