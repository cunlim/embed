<?php

use App\Models\Category;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Schema;
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
});

test('generateCode는 CAT_ 접두사와 12자리 문자열을 반환한다', function () {
    $code = Category::generateCode();

    expect($code)->toStartWith('CAT_')->toHaveLength(12);
});

test('generateCode는 고유한 코드를 생성한다', function () {
    $codes = array_map(fn () => Category::generateCode(), range(1, 50));

    expect($codes)->toHaveCount(count(array_unique($codes)));
});

test('categoryEmbeddings 릴레이션은 HasMany 인스턴스를 반환한다', function () {
    $category = Category::factory()->create();

    expect($category->categoryEmbeddings())->toBeInstanceOf(HasMany::class);
});
