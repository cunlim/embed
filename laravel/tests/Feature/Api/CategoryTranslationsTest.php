<?php

use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Models\User;
use Pgvector\Laravel\Vector;

beforeEach(function () {
    $this->user = User::factory()->create();
});

test('GET /api/categories/{id}/translations returns translations and embeddings', function () {
    $category = Category::factory()->create([
        'category_name_ko' => '테스트>카테고리',
        'category_name_zh' => '测试>类别',
        'category_name_en' => 'Test>Category',
    ]);

    // 1024-dim 벡터 생성 (pgvector 컬럼 제약조건 충족)
    // JSON 인코딩/디코딩 시 0.0은 0이 되므로 int 0 사용
    $embedding = array_fill(0, 1024, 0);
    $embedding[0] = 0.022;
    $embedding[1] = -0.056;
    $embedding[2] = 0.091;
    $embedding[3] = 0.003;
    $embedding[4] = -0.018;

    CategoryEmbedding::factory()->create([
        'category_id' => $category->id,
        'language' => 'ko',
        'embedding' => new Vector($embedding),
        'embed_model_name' => 'bge-m3:latest',
    ]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->getJson("/api/categories/{$category->id}/translations");

    $response->assertOk()
        ->assertJsonPath('data.id', $category->id)
        ->assertJsonPath('data.category_code', $category->category_code)
        ->assertJsonPath('data.embedding_dimensions', 1024)
        ->assertJsonPath('data.languages.ko.translation_text', '테스트>카테고리')
        ->assertJsonPath('data.languages.ko.embedding.status', 'completed')
        ->assertJsonPath('data.languages.ko.embedding.preview', $embedding)
        ->assertJsonPath('data.languages.en.translation_text', 'Test>Category')
        ->assertJsonPath('data.languages.en.embedding.status', 'pending')
        ->assertJsonPath('data.languages.zh.translation_text', '测试>类别')
        ->assertJsonPath('data.languages.zh.embedding.status', 'pending');
});

test('GET /api/categories/{id}/translations returns all languages completed when embeddings exist', function () {
    $category = Category::factory()->create([
        'category_name_ko' => '테스트>카테고리',
        'category_name_zh' => '测试>类别',
        'category_name_en' => 'Test>Category',
    ]);

    $embedding = array_fill(0, 1024, 0.0);
    $embedding[0] = 0.022;
    $embedding[1] = -0.056;
    $embedding[2] = 0.091;
    $embedding[3] = 0.003;
    $embedding[4] = -0.018;

    foreach (['ko', 'en', 'zh'] as $lang) {
        CategoryEmbedding::factory()->create([
            'category_id' => $category->id,
            'language' => $lang,
            'embedding' => new Vector($embedding),
            'embed_model_name' => 'bge-m3:latest',
        ]);
    }

    $response = $this->actingAs($this->user, 'sanctum')
        ->getJson("/api/categories/{$category->id}/translations");

    $response->assertOk()
        ->assertJsonPath('data.languages.ko.embedding.status', 'completed')
        ->assertJsonPath('data.languages.en.embedding.status', 'completed')
        ->assertJsonPath('data.languages.zh.embedding.status', 'completed');
});

test('GET /api/categories/{id}/translations returns 401 without auth', function () {
    $category = Category::factory()->create();

    $response = $this->getJson("/api/categories/{$category->id}/translations");

    $response->assertUnauthorized();
});

test('GET /api/categories/{id}/translations returns 404 for missing category', function () {
    $response = $this->actingAs($this->user, 'sanctum')
        ->getJson('/api/categories/99999/translations');

    $response->assertNotFound();
});
