<?php

use App\Models\Category;
use App\Models\User;

beforeEach(function () {
    $user = User::factory()->create(['role' => 'superadmin']);

    Category::factory()->create([
        'user_id' => 1,
        'category_name_ko' => '패션의류>여성의류>원피스',
        'category_code' => 'A01',
    ]);
    Category::factory()->create([
        'user_id' => 1,
        'category_name_ko' => '패션의류>여성의류>티셔츠',
        'category_code' => 'A02',
    ]);
    Category::factory()->create([
        'user_id' => 1,
        'category_name_ko' => '패션의류>남성의류>셔츠',
        'category_code' => 'A03',
    ]);
    Category::factory()->create([
        'user_id' => 1,
        'category_name_ko' => '식품>농산물>과일>사과',
        'category_code' => 'A04',
    ]);
    Category::factory()->create([
        'user_id' => 1,
        'category_name_ko' => '식품>농산물>채소',
        'category_code' => 'A05',
    ]);
    Category::factory()->create([
        'user_id' => 2,
        'category_name_ko' => '타유저>중분류>소분류',
        'category_code' => 'A06',
    ]);
});

describe('GET /api/categories/levels', function () {
    test('파라미터 없으면 대 목록을 반환한다', function () {
        $response = $this->getJson('/api/categories/levels');

        $response->assertOk();
        $data = $response->json('data');
        expect($data)->toHaveKey('대');
        expect($data['대'])->toBeArray();
        expect($data['대'])->toContain('패션의류');
        expect($data['대'])->toContain('식품');
        // user_id=2의 카테고리는 제외
        expect($data['대'])->not->toContain('타유저');
        // 중복 제거
        expect(count($data['대']))->toBe(2);
    });

    test('대 파라미터가 있으면 중 목록을 반환한다', function () {
        $response = $this->getJson('/api/categories/levels?대=패션의류');

        $response->assertOk();
        $data = $response->json('data');
        expect($data)->toHaveKey('중');
        expect($data['중'])->toBeArray();
        expect($data['중'])->toContain('여성의류');
        expect($data['중'])->toContain('남성의류');
        expect(count($data['중']))->toBe(2);
    });

    test('대,중 파라미터가 있으면 소 목록을 반환한다', function () {
        $response = $this->getJson('/api/categories/levels?대=패션의류&중=여성의류');

        $response->assertOk();
        $data = $response->json('data');
        expect($data)->toHaveKey('소');
        expect($data['소'])->toContain('원피스');
        expect($data['소'])->toContain('티셔츠');
    });

    test('대,중,소 파라미터가 있으면 세 목록을 반환한다', function () {
        $response = $this->getJson('/api/categories/levels?대=패션의류&중=여성의류&소=티셔츠');

        $response->assertOk();
        $data = $response->json('data');
        expect($data)->toHaveKey('세');
        expect($data['세'])->toBeArray();
    });

    test('세 목록에는 4단계인 항목만 포함된다', function () {
        // '채소'는 3단계 (식품>농산물>채소) → 제외
        $response = $this->getJson('/api/categories/levels?대=식품&중=농산물&소=채소');

        $response->assertOk();
        $data = $response->json('data');
        expect($data['세'])->toBeArray();
        expect($data['세'])->toHaveLength(0);
    });

    test('일치하는 항목이 없으면 빈 배열을 반환한다', function () {
        $response = $this->getJson('/api/categories/levels?대=존재하지않음');

        $response->assertOk();
        $data = $response->json('data');
        expect($data['중'])->toBeArray();
        expect($data['중'])->toHaveLength(0);
    });
});
