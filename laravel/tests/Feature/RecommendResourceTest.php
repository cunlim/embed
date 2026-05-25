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

    $category->similarity_score = 0.9876;
    $category->similarity_score_ko = 0.9876;
    $category->similarity_score_en = 0.8210;
    $category->similarity_score_zh = 0.7950;
    $category->rank_ko = 1;
    $category->rank_en = 2;
    $category->rank_zh = 3;

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
        'rank' => 2,
    ]);
    expect($data['per_language_scores']['zh'])->toMatchArray([
        'similarity_score' => 0.7950,
        'rank' => 3,
    ]);
});
