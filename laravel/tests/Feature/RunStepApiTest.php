<?php

use App\Models\Category;
use App\Models\User;
use App\Services\EmbeddingGenerator;
use App\Services\Translator;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('POST /api/categories/{category}/run-step — 인증 없이 401을 반환한다', function () {
    $category = Category::factory()->create();

    $response = $this->postJson("/api/categories/{$category->id}/run-step", [
        'step' => 'translation.zh',
    ]);

    $response->assertUnauthorized();
});

test('POST /api/categories/{category}/run-step — 유효하지 않은 step은 422를 반환한다', function () {
    $user = User::factory()->create();
    $category = Category::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson("/api/categories/{$category->id}/run-step", [
        'step' => 'invalid.step',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['step']);
});

test('POST /api/categories/{category}/run-step — translation.zh가 정상 동작한다', function () {
    $translator = mock(Translator::class);
    $translator->shouldReceive('translate')
        ->once()
        ->with('테스트 카테고리', 'zh')
        ->andReturn('测试分类');
    app()->instance(Translator::class, $translator);

    $user = User::factory()->create();
    $category = Category::factory()->create(['category_name_ko' => '테스트 카테고리', 'user_id' => $user->id]);

    $response = $this->actingAs($user, 'sanctum')->postJson("/api/categories/{$category->id}/run-step", [
        'step' => 'translation.zh',
    ]);

    $response->assertOk()
        ->assertJson([
            'step' => 'translation.zh',
            'status' => 'completed',
        ]);
    $response->assertJsonStructure([
        'translations' => [
            'id', 'category_code', 'category_name_ko', 'languages',
        ],
    ]);
    expect($response->json('result'))->toBe('测试分类');

    // DB에 저장되었는지 확인
    $category->refresh();
    expect($category->category_name_zh)->toBe('测试分类');
});

test('POST /api/categories/{category}/run-step — embedding.ko가 정상 동작한다', function () {
    $embedder = mock(EmbeddingGenerator::class);
    $embedder->shouldReceive('generate')
        ->once()
        ->with('테스트 카테고리')
        ->andReturn(array_fill(0, 1024, 0.01));
    app()->instance(EmbeddingGenerator::class, $embedder);

    $user = User::factory()->create();
    $category = Category::factory()->create(['category_name_ko' => '테스트 카테고리', 'user_id' => $user->id]);

    $response = $this->actingAs($user, 'sanctum')->postJson("/api/categories/{$category->id}/run-step", [
        'step' => 'embedding.ko',
    ]);

    $response->assertOk()
        ->assertJson([
            'step' => 'embedding.ko',
            'status' => 'completed',
        ]);
    $response->assertJsonStructure([
        'translations' => [
            'id', 'category_code', 'languages',
        ],
    ]);

    // DB에 저장되었는지 확인
    $this->assertDatabaseHas('category_embeddings', [
        'category_id' => $category->id,
        'language' => 'ko',
    ]);

    // search_logs 테이블에도 저장되었는지 확인
    $this->assertDatabaseHas('search_logs', [
        'search_keyword' => '테스트 카테고리',
        'normalized_keyword' => '테스트 카테고리',
        'embed_model_name' => config('services.embed.model', 'bge-m3:latest'),
    ]);
});

test('POST /api/categories/{category}/run-step — 번역 없이 임베딩 실행 시 422를 반환한다', function () {
    $user = User::factory()->create();
    $category = Category::factory()->create(['category_name_ko' => '테스트', 'user_id' => $user->id]);

    $response = $this->actingAs($user, 'sanctum')->postJson("/api/categories/{$category->id}/run-step", [
        'step' => 'embedding.zh',
    ]);

    $response->assertStatus(422);
});

test('POST /api/categories/{category}/run-step — Provider 실패 시 500과 failed 상태를 반환한다', function () {
    $translator = mock(Translator::class);
    $translator->shouldReceive('translate')
        ->once()
        ->andThrow(new RuntimeException('Ollama rate limit exceeded'));
    app()->instance(Translator::class, $translator);

    $user = User::factory()->create();
    $category = Category::factory()->create(['category_name_ko' => '테스트', 'user_id' => $user->id]);

    $response = $this->actingAs($user, 'sanctum')->postJson("/api/categories/{$category->id}/run-step", [
        'step' => 'translation.zh',
    ]);

    $response->assertStatus(500)
        ->assertJson([
            'step' => 'translation.zh',
            'status' => 'failed',
            'error' => 'Ollama rate limit exceeded',
        ]);
});

test('POST /api/categories/{category}/run-step — 일반회원은 타인 카테고리에 run-step을 실행할 수 없다', function () {
    $owner = User::factory()->create(['role' => 'member']);
    $other = User::factory()->create(['role' => 'member']);
    $category = Category::factory()->create(['category_name_ko' => '테스트', 'user_id' => $owner->id]);

    $response = $this->actingAs($other, 'sanctum')->postJson("/api/categories/{$category->id}/run-step", [
        'step' => 'translation.zh',
    ]);

    $response->assertStatus(403);
});

test('POST /api/categories/{category}/run-step — admin은 타인 카테고리에도 run-step을 실행할 수 있다', function () {
    $translator = mock(Translator::class);
    $translator->shouldReceive('translate')->once()->andReturn('测试');
    app()->instance(Translator::class, $translator);

    $owner = User::factory()->create(['role' => 'member']);
    $admin = User::factory()->create(['role' => 'admin']);
    $category = Category::factory()->create(['category_name_ko' => '테스트', 'user_id' => $owner->id]);

    $response = $this->actingAs($admin, 'sanctum')->postJson("/api/categories/{$category->id}/run-step", [
        'step' => 'translation.zh',
    ]);

    $response->assertOk();
});
