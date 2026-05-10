<?php

use App\Models\CategoryEmbedding;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Schema;
use Pgvector\Laravel\Vector;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function () {
    if (! Schema::hasTable('categories')) {
        Schema::create('categories', function ($table) {
            $table->id();
            $table->string('category_code', 50)->unique();
            $table->string('category_name_ko', 255);
            $table->string('category_name_zh', 255)->nullable();
            $table->string('category_name_en', 255)->nullable();
            $table->timestamps();
        });
    }

    if (! Schema::hasTable('category_embeddings')) {
        Schema::create('category_embeddings', function ($table) {
            $table->id();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->string('language', 10);
            $table->string('embed_model_name', 100);
            $table->text('embedding');
            $table->unique(['category_id', 'language', 'embed_model_name']);
            $table->timestamps();
        });
    }
});

test('embedding 컬럼은 Vector 타입으로 캐스팅된다', function () {
    $embedding = CategoryEmbedding::factory()->create();

    expect($embedding->embedding)->toBeInstanceOf(Vector::class);
});

test('category 릴레이션은 BelongsTo 인스턴스를 반환한다', function () {
    $embedding = CategoryEmbedding::factory()->create();

    expect($embedding->category())->toBeInstanceOf(BelongsTo::class);
});
