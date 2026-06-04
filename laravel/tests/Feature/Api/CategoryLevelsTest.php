<?php

use App\Models\Category;
use App\Models\User;

beforeEach(function () {
    $user = User::factory()->create(['role' => 'superadmin']);

    Category::factory()->create([
        'user_id' => 1,
        'category_name_ko' => '패션의류>여성의류>원피스',
        'category_name_en' => 'Fashion>Women>Dress',
        'category_name_zh' => '时装>女装>连衣裙',
        'category_code' => 'A01',
    ]);
    Category::factory()->create([
        'user_id' => 1,
        'category_name_ko' => '패션의류>여성의류>티셔츠',
        'category_name_en' => 'Fashion>Women>T-shirt',
        'category_name_zh' => '时装>女装>T恤',
        'category_code' => 'A02',
    ]);
    Category::factory()->create([
        'user_id' => 1,
        'category_name_ko' => '패션의류>남성의류>셔츠',
        'category_name_en' => 'Fashion>Men>Shirt',
        'category_name_zh' => '时装>男装>衬衫',
        'category_code' => 'A03',
    ]);
    Category::factory()->create([
        'user_id' => 1,
        'category_name_ko' => '식품>농산물>과일>사과',
        'category_name_en' => 'Food>Agriculture>Fruit>Apple',
        'category_name_zh' => '食品>农产品>水果>苹果',
        'category_code' => 'A04',
    ]);
    Category::factory()->create([
        'user_id' => 1,
        'category_name_ko' => '식품>농산물>채소',
        'category_name_en' => 'Food>Agriculture>Vegetable',
        'category_name_zh' => '食品>农产品>蔬菜',
        'category_code' => 'A05',
    ]);
    Category::factory()->create([
        'user_id' => 2,
        'category_name_ko' => '타유저>중분류>소분류',
        'category_name_en' => 'OtherUser>Mid>Sub',
        'category_name_zh' => '其他用户>中分类>小分类',
        'category_code' => 'A06',
    ]);
    Category::factory()->create([
        'user_id' => 1,
        'category_name_ko' => '테스트리프',
        'category_name_en' => 'TestLeaf',
        'category_name_zh' => '测试叶子',
        'category_code' => 'A07',
    ]);
});

describe('GET /api/categories/levels', function () {
    test('파라미터 없으면 대 목록을 반환한다', function () {
        $response = $this->getJson('/api/categories/levels');

        $response->assertOk();
        $data = $response->json('data');
        expect($data['options'])->toBeArray();
        expect($data['options'])->toContain('패션의류');
        expect($data['options'])->toContain('식품');
        // user_id=2의 카테고리는 제외
        expect($data['options'])->not->toContain('타유저');
        // 중복 제거
        expect(count($data['options']))->toBe(3);
    });

    test('대 파라미터가 있으면 중 목록을 반환한다', function () {
        $response = $this->getJson('/api/categories/levels?'.http_build_query(['대' => '패션의류']));

        $response->assertOk();
        $data = $response->json('data');
        expect($data['options'])->toBeArray();
        expect($data['options'])->toContain('여성의류');
        expect($data['options'])->toContain('남성의류');
        expect(count($data['options']))->toBe(2);
    });

    test('대,중 파라미터가 있으면 소 목록을 반환한다', function () {
        $response = $this->getJson('/api/categories/levels?'.http_build_query(['대' => '패션의류', '중' => '여성의류']));

        $response->assertOk();
        $data = $response->json('data');
        expect($data['options'])->toBeArray();
        expect($data['options'])->toContain('원피스');
        expect($data['options'])->toContain('티셔츠');
    });

    test('대,중,소 파라미터가 있으면 리프 카테고리를 반환한다', function () {
        $response = $this->getJson('/api/categories/levels?'.http_build_query(['대' => '패션의류', '중' => '여성의류', '소' => '티셔츠']));

        $response->assertOk();
        $data = $response->json('data');
        expect($data['isLeaf'])->toBe(true);
        expect($data['leafCategoryId'])->not->toBeNull();
    });

    test('일치하는 항목이 없으면 빈 옵션을 반환한다', function () {
        $response = $this->getJson('/api/categories/levels?'.http_build_query(['대' => '존재하지않음']));

        $response->assertOk();
        $data = $response->json('data');
        expect($data['options'])->toBeArray();
        expect($data['options'])->toHaveLength(0);
    });

    test('대만 제공하고 소분류가 단일이면 leafCategoryId를 반환한다', function () {
        $response = $this->getJson('/api/categories/levels?'.http_build_query(['대' => '테스트리프']));

        $response->assertOk();
        $data = $response->json('data');
        expect($data['options'])->toBeArray();
        expect($data['isLeaf'])->toBe(true);
        expect($data['leafCategoryId'])->not->toBeNull();
    });

    test('대만 제공하고 하위 목록이 있으면 isLeaf는 false이다', function () {
        $response = $this->getJson('/api/categories/levels?'.http_build_query(['대' => '패션의류']));

        $response->assertOk();
        $data = $response->json('data');
        expect($data)->toHaveKey('leafCategoryId');
        expect($data['isLeaf'])->toBe(false);
    });

    test('lang=en이면 영어 카테고리명으로 계층을 반환한다', function () {
        $response = $this->getJson('/api/categories/levels?'.http_build_query(['lang' => 'en']));

        $response->assertOk();
        $data = $response->json('data');
        expect($data['options'])->toContain('Fashion');
        expect($data['options'])->not->toContain('패션의류');
        expect($data['options'])->toContain('Food');
    });

    test('lang=en이고 대 파라미터가 있으면 영어 중분류를 반환한다', function () {
        $response = $this->getJson('/api/categories/levels?'.http_build_query(['lang' => 'en', 'cat1' => 'Fashion']));

        $response->assertOk();
        $data = $response->json('data');
        expect($data['options'])->toContain('Women');
        expect($data['options'])->toContain('Men');
        expect($data['options'])->not->toContain('여성의류');
    });

    test('lang=zh이면 중국어 카테고리명으로 계층을 반환한다', function () {
        $response = $this->getJson('/api/categories/levels?'.http_build_query(['lang' => 'zh']));

        $response->assertOk();
        $data = $response->json('data');
        expect($data['options'])->toContain('时装');
        expect($data['options'])->toContain('食品');
    });

    test('lang 파라미터가 없으면 기본값 ko로 동작한다', function () {
        $response = $this->getJson('/api/categories/levels');

        $response->assertOk();
        $data = $response->json('data');
        expect($data['options'])->toContain('패션의류');
    });

    test('잘못된 lang 값이면 400을 반환한다', function () {
        $response = $this->getJson('/api/categories/levels?'.http_build_query(['lang' => 'jp']));

        $response->assertStatus(400);
    });
});
