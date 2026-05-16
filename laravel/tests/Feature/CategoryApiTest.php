<?php

use App\Jobs\BatchTranslatePipeline;
use App\Jobs\TranslateAndEmbedJob;
use App\Models\Category;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Schema;

beforeEach(function () {
    Schema::create('users', function (Blueprint $table) {
        $table->id();
        $table->string('name');
        $table->string('email')->unique();
        $table->timestamp('email_verified_at')->nullable();
        $table->string('password');
        $table->rememberToken();
        $table->timestamps();
    });

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
    Schema::dropIfExists('users');
});

test('GET /api/categories — 카테고리 목록을 반환한다', function () {
    Category::factory()->count(3)->create();

    $response = $this->getJson('/api/categories');

    $response->assertOk()
        ->assertJsonCount(3, 'data');
});

test('POST /api/categories — 인증 없이 401을 반환한다', function () {
    $response = $this->postJson('/api/categories', [
        'category_name_ko' => '패션의류',
    ]);

    $response->assertUnauthorized();
});

test('POST /api/categories — 인증된 사용자는 201을 반환하고 Job을 dispatch한다', function () {
    Bus::fake();

    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories', [
        'category_name_ko' => '패션의류',
    ]);

    $response->assertCreated();

    Bus::assertDispatched(TranslateAndEmbedJob::class, 2);
});

test('POST /api/categories/batch-translate — 인증 없이 401을 반환한다', function () {
    $response = $this->postJson('/api/categories/batch-translate', [
        'target_language' => 'zh',
    ]);

    $response->assertUnauthorized();
});

test('POST /api/categories/batch-translate — 인증된 사용자는 202를 반환한다', function () {
    Bus::fake();

    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories/batch-translate', [
        'target_language' => 'zh',
    ]);

    $response->assertAccepted();

    Bus::assertDispatched(BatchTranslatePipeline::class);
});

test('POST /api/categories/batch-translate — target_language가 없으면 422를 반환한다', function () {
    Bus::fake();

    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories/batch-translate', []);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['target_language']);
});

test('POST /api/categories/batch-translate — 지원하지 않는 언어면 422를 반환한다', function () {
    Bus::fake();

    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories/batch-translate', [
        'target_language' => 'ja',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['target_language']);
});
