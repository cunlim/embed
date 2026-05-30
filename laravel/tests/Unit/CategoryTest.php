<?php

use App\Models\Category;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class);
uses(RefreshDatabase::class);

test('generateCode는 CAT_ 접두사와 12자리 문자열을 반환한다', function () {
    $code = Category::generateCode(1);

    expect($code)->toStartWith('CAT_')->toHaveLength(12);
});

test('generateCode는 고유한 코드를 생성한다', function () {
    $codes = array_map(fn () => Category::generateCode(1), range(1, 50));

    expect($codes)->toHaveCount(count(array_unique($codes)));
});

test('embeddings 릴레이션은 HasMany 인스턴스를 반환한다', function () {
    $category = Category::factory()->create();

    expect($category->embeddings())->toBeInstanceOf(HasMany::class);
});

test('user 릴레이션은 BelongsTo 인스턴스를 반환한다', function () {
    $category = Category::factory()->create(['user_id' => 1]);

    expect($category->user())->toBeInstanceOf(BelongsTo::class);
});
