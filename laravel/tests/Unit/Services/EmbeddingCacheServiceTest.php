<?php

use App\Models\SearchLog;
use App\Services\EmbeddingCacheService;
use App\Services\EmbeddingGenerator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Pgvector\Laravel\Vector;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function () {
    if (! Schema::hasTable("users")) {
        Schema::create("users", function ($table) {
            $table->id();
            $table->string("name");
            $table->string("email")->unique();
            $table->string("password")->nullable();
            $table->string("provider")->nullable();
            $table->string("provider_id")->nullable();
            $table->timestamps();
        });
    }

    Schema::create("search_logs", function ($table) {
        $table->id();
        $table->foreignId("user_id")->nullable()->constrained();
        $table->string("session_id", 36)->nullable();
        $table->string("search_keyword", 500);
        $table->string("normalized_keyword", 500)->nullable();
        $table->string("embed_model_name", 100)->nullable();
        $table->text("embedding")->nullable();
        $table->timestamps();
        $table->index("normalized_keyword");
    });
});

afterEach(function () {
    Schema::dropIfExists("search_logs");
});

test("getOrCreateEmbedding — 캐시 히트 시 임베딩을 재생성하지 않는다", function () {
    $embedding = array_fill(0, 1024, 0.1);

    DB::table("users")->insert([
        "id" => 1,
        "name" => "Test User",
        "email" => "test@example.com",
    ]);

    SearchLog::create([
        "user_id" => 1,
        "session_id" => "test-session",
        "search_keyword" => "NIKE Shoes",
        "normalized_keyword" => "nike shoes",
        "embed_model_name" => "bge-m3:latest",
        "embedding" => $embedding,
    ]);

    $mockGenerator = $this->mock(EmbeddingGenerator::class);
    $mockGenerator->shouldReceive("generate")->never();

    $service = app(EmbeddingCacheService::class);
    $result = $service->getOrCreateEmbedding("  NIKE   SHOES  ", "bge-m3:latest", 1, "test-session");

    expect($result)->toBeInstanceOf(SearchLog::class);
    expect($result->search_keyword)->toBe("NIKE Shoes");
    expect($result->normalized_keyword)->toBe("nike shoes");
});

test("getOrCreateEmbedding — 캐시 미스 시 새 임베딩을 생성하고 저장한다", function () {
    $embedding = array_fill(0, 1024, 0.05);

    $mockGenerator = $this->mock(EmbeddingGenerator::class);
    $mockGenerator->shouldReceive("generate")
        ->with("청바지")
        ->once()
        ->andReturn($embedding);

    $service = app(EmbeddingCacheService::class);
    $result = $service->getOrCreateEmbedding("청바지", "bge-m3:latest", null, "session-abc");

    expect($result)->toBeInstanceOf(SearchLog::class);
    expect($result->search_keyword)->toBe("청바지");
    expect($result->normalized_keyword)->toBe("청바지");
    expect($result->embed_model_name)->toBe("bge-m3:latest");
    expect($result->session_id)->toBe("session-abc");

    $saved = SearchLog::query()
        ->where("normalized_keyword", "청바지")
        ->where("session_id", "session-abc")
        ->first();

    expect($saved)->not->toBeNull();
});

test("getOrCreateEmbedding — 정규화를 통해 공백/대소문자 차이가 있는 키워드가 캐시 히트된다", function () {
    $embedding = array_fill(0, 1024, 0.2);

    SearchLog::create([
        "session_id" => "session-xyz",
        "search_keyword" => "  NIKE   Air   Max  ",
        "normalized_keyword" => "nike air max",
        "embed_model_name" => "bge-m3:latest",
        "embedding" => $embedding,
    ]);

    $mockGenerator = $this->mock(EmbeddingGenerator::class);
    $mockGenerator->shouldReceive("generate")->never();

    $service = app(EmbeddingCacheService::class);
    $result = $service->getOrCreateEmbedding("NIKE air max", "bge-m3:latest", null, "session-xyz");

    expect($result->search_keyword)->toBe("  NIKE   Air   Max  ");
    expect($result->normalized_keyword)->toBe("nike air max");
});

test("getOrCreateEmbedding — 같은 키워드라도 userId가 다르면 다른 캐시로 취급한다", function () {
    $user1Embedding = array_fill(0, 1024, 0.1);
    $user2Embedding = array_fill(0, 1024, 0.3);

    DB::table("users")->insert([
        "id" => 1,
        "name" => "User 1",
        "email" => "user1@example.com",
    ]);
    DB::table("users")->insert([
        "id" => 2,
        "name" => "User 2",
        "email" => "user2@example.com",
    ]);

    SearchLog::create([
        "user_id" => 1,
        "session_id" => "s1",
        "search_keyword" => "운동화",
        "normalized_keyword" => "운동화",
        "embed_model_name" => "bge-m3:latest",
        "embedding" => $user1Embedding,
    ]);

    $mockGenerator = $this->mock(EmbeddingGenerator::class);
    $mockGenerator->shouldReceive("generate")
        ->with("운동화")
        ->once()
        ->andReturn($user2Embedding);

    $service = app(EmbeddingCacheService::class);
    $result = $service->getOrCreateEmbedding("운동화", "bge-m3:latest", 2, "s2");

    expect($result->user_id)->toBe(2);
    expect($result->embedding)->toBeInstanceOf(Vector::class);
    expect($result->embedding->toArray())->toBe($user2Embedding);
});
