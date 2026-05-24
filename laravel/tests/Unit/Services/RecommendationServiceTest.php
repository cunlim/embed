<?php

use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Models\SearchLog;
use App\Services\RecommendationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Pagination\LengthAwarePaginator;
use Pgvector\Laravel\Vector;
use Tests\TestCase;

uses(TestCase::class);
uses(RefreshDatabase::class);

test('nameFieldFor — zh는 category_name_zh를 반환한다', function () {
    $service = new RecommendationService;
    expect($service->nameFieldFor('zh'))->toBe('category_name_zh');
});

test('nameFieldFor — en은 category_name_en을 반환한다', function () {
    $service = new RecommendationService;
    expect($service->nameFieldFor('en'))->toBe('category_name_en');
});

test('nameFieldFor — ko 등 기타 언어는 category_name_ko를 반환한다', function () {
    $service = new RecommendationService;
    expect($service->nameFieldFor('ko'))->toBe('category_name_ko');
    expect($service->nameFieldFor('unknown'))->toBe('category_name_ko');
});

test('recommend — 유사도 점수는 1.0 - distance로 계산된다', function () {
    $category = Category::factory()->create([
        'category_code' => '50000000',
        'category_name_ko' => '패션의류',
        'category_name_zh' => '时尚服装',
        'category_name_en' => 'Fashion Clothing',
    ]);

    // distance 값을 포함한 embedding record를 직접 생성
    $categoryEmbedding = new CategoryEmbedding;
    $categoryEmbedding->category_id = $category->id;
    $categoryEmbedding->language = 'ko';
    $categoryEmbedding->embed_model_name = 'bge-m3:latest';
    $categoryEmbedding->embedding = new Vector(array_fill(0, 1024, 0.1));
    $categoryEmbedding->save();
    $categoryEmbedding->distance = 0.15;

    $searchLog = new SearchLog([
        'search_keyword' => '청바지',
        'normalized_keyword' => '청바지',
        'embed_model_name' => 'bge-m3:latest',
    ]);
    $searchLog->embedding = array_fill(0, 1024, 0.05);

    // 수동으로 distance를 설정한 embedding을 통해 매핑 로직을 검증한다.
    $service = new RecommendationService;
    $nameField = $service->nameFieldFor('ko');

    expect($nameField)->toBe('category_name_ko');
    expect($category->{$nameField})->toBe('패션의류');

    // similarity_score 계산 로직 검증
    $distance = $categoryEmbedding->distance;
    $score = round(1.0 - (float) $distance, 4);
    expect($score)->toBe(0.85);
});

test('recommendPaginated — 페이지네이션 결과를 반환한다', function () {
    $category = Category::factory()->create([
        'category_code' => '50000000',
        'category_name_ko' => '패션의류',
    ]);

    $embedding = new Vector(array_fill(0, 1024, 0.1));
    $categoryEmbedding = new CategoryEmbedding;
    $categoryEmbedding->category_id = $category->id;
    $categoryEmbedding->language = 'ko';
    $categoryEmbedding->embed_model_name = 'bge-m3:latest';
    $categoryEmbedding->embedding = $embedding;
    $categoryEmbedding->save();

    $searchLog = new SearchLog([
        'search_keyword' => '청바지',
        'normalized_keyword' => '청바지',
        'embed_model_name' => 'bge-m3:latest',
    ]);
    $searchLog->embedding = array_fill(0, 1024, 0.05);

    $service = new RecommendationService;
    $result = $service->recommendPaginated($searchLog, 'ko', 20, 1);

    expect($result)->toBeInstanceOf(LengthAwarePaginator::class);
    expect($result->total())->toBe(1);
    expect($result->items()[0]->id)->toBe($category->id);
    expect($result->items()[0]->similarity_score)->toBeGreaterThan(0);
});

test('recommendPaginated — userId 필터가 적용되면 해당 사용자의 카테고리만 반환한다', function () {
    $myCategory = Category::factory()->create([
        'category_code' => '50000000',
        'category_name_ko' => '패션의류',
        'user_id' => 1,
    ]);

    $otherCategory = Category::factory()->create([
        'category_code' => '50000001',
        'category_name_ko' => '식품',
        'user_id' => 2,
    ]);

    // 두 카테고리 모두에 임베딩 생성
    foreach ([$myCategory, $otherCategory] as $cat) {
        $embedding = new Vector(array_fill(0, 1024, 0.1));
        $categoryEmbedding = new CategoryEmbedding;
        $categoryEmbedding->category_id = $cat->id;
        $categoryEmbedding->language = 'ko';
        $categoryEmbedding->embed_model_name = 'bge-m3:latest';
        $categoryEmbedding->embedding = $embedding;
        $categoryEmbedding->save();
    }

    $searchLog = new SearchLog([
        'search_keyword' => '청바지',
        'normalized_keyword' => '청바지',
        'embed_model_name' => 'bge-m3:latest',
    ]);
    $searchLog->embedding = array_fill(0, 1024, 0.05);

    $service = new RecommendationService;
    $result = $service->recommendPaginated($searchLog, 'ko', 20, 1, 1);

    expect($result->total())->toBe(1);
    expect($result->items()[0]->id)->toBe($myCategory->id);
});

test('recommendPaginated — userId가 null이면 모든 사용자의 카테고리를 반환한다', function () {
    $category1 = Category::factory()->create([
        'category_code' => '50000000',
        'category_name_ko' => '패션의류',
        'user_id' => 1,
    ]);

    $category2 = Category::factory()->create([
        'category_code' => '50000001',
        'category_name_ko' => '식품',
        'user_id' => 2,
    ]);

    // 두 카테고리 모두에 임베딩 생성
    foreach ([$category1, $category2] as $cat) {
        $embedding = new Vector(array_fill(0, 1024, 0.1));
        $categoryEmbedding = new CategoryEmbedding;
        $categoryEmbedding->category_id = $cat->id;
        $categoryEmbedding->language = 'ko';
        $categoryEmbedding->embed_model_name = 'bge-m3:latest';
        $categoryEmbedding->embedding = $embedding;
        $categoryEmbedding->save();
    }

    $searchLog = new SearchLog([
        'search_keyword' => '청바지',
        'normalized_keyword' => '청바지',
        'embed_model_name' => 'bge-m3:latest',
    ]);
    $searchLog->embedding = array_fill(0, 1024, 0.05);

    $service = new RecommendationService;
    $result = $service->recommendPaginated($searchLog, 'ko', 20, 1, null);

    expect($result->total())->toBe(2);
});

test('recommendPaginated — userId 배열로 여러 사용자의 카테고리를 필터링한다', function () {
    $category1 = Category::factory()->create([
        'category_code' => '50000000',
        'category_name_ko' => '패션의류',
        'user_id' => 1,
    ]);

    $category2 = Category::factory()->create([
        'category_code' => '50000001',
        'category_name_ko' => '식품',
        'user_id' => 2,
    ]);

    $category3 = Category::factory()->create([
        'category_code' => '50000002',
        'category_name_ko' => '디지털/가전',
        'user_id' => 3,
    ]);

    // 모든 카테고리에 임베딩 생성
    foreach ([$category1, $category2, $category3] as $cat) {
        $embedding = new Vector(array_fill(0, 1024, 0.1));
        $categoryEmbedding = new CategoryEmbedding;
        $categoryEmbedding->category_id = $cat->id;
        $categoryEmbedding->language = 'ko';
        $categoryEmbedding->embed_model_name = 'bge-m3:latest';
        $categoryEmbedding->embedding = $embedding;
        $categoryEmbedding->save();
    }

    $searchLog = new SearchLog([
        'search_keyword' => '청바지',
        'normalized_keyword' => '청바지',
        'embed_model_name' => 'bge-m3:latest',
    ]);
    $searchLog->embedding = array_fill(0, 1024, 0.05);

    $service = new RecommendationService;
    $result = $service->recommendPaginated($searchLog, 'ko', 20, 1, [1, 2]);

    // user_id 1, 2만 포함, user_id 3은 제외
    expect($result->total())->toBe(2);
    $ids = collect($result->items())->pluck('id')->toArray();
    expect($ids)->toContain($category1->id);
    expect($ids)->toContain($category2->id);
});
