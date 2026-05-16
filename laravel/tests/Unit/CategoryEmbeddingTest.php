<?php

use App\Models\CategoryEmbedding;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Pgvector\Laravel\Vector;
use Tests\TestCase;

uses(TestCase::class);
uses(RefreshDatabase::class);

test('embedding 컬럼은 Vector 타입으로 캐스팅된다', function () {
    $embedding = CategoryEmbedding::factory()->create();

    expect($embedding->embedding)->toBeInstanceOf(Vector::class);
});

test('category 릴레이션은 BelongsTo 인스턴스를 반환한다', function () {
    $embedding = CategoryEmbedding::factory()->create();

    expect($embedding->category())->toBeInstanceOf(BelongsTo::class);
});

test('scopeSimilarTo — language 필터와 distance alias를 포함한 쿼리를 생성한다', function () {
    $vector = array_fill(0, 1024, 0.01);
    $query = CategoryEmbedding::similarTo($vector, 'ko', 5);

    $sql = $query->toSql();
    expect($sql)->toContain('"language"')
        ->toContain('<=>')
        ->toContain('::vector')
        ->toContain('as distance')
        ->toContain('limit');
});
