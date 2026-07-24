<?php

use App\Models\Category;
use App\Models\User;

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

test('POST /api/categories — 인증된 사용자는 201을 반환한다', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories', [
        'category_name_ko' => '패션의류',
    ]);

    $response->assertCreated()
        ->assertJsonStructure([
            'data' => [
                'id',
                'category_code',
                'category_name_ko',
            ],
        ]);
});

test('POST /api/categories — 같은 사용자의 중복 category_code는 422를 반환한다', function () {
    $user = User::factory()->create();
    $existing = Category::factory()->create(['user_id' => $user->id]);

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories', [
        'category_name_ko' => '새카테고리',
        'category_code' => $existing->category_code,
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['category_code']);
});

test('POST /api/categories — 다른 사용자의 category_code는 허용된다', function () {
    $user1 = User::factory()->create();
    $user2 = User::factory()->create();
    $existing = Category::factory()->create(['user_id' => $user1->id]);

    $response = $this->actingAs($user2, 'sanctum')->postJson('/api/categories', [
        'category_name_ko' => '새카테고리',
        'category_code' => $existing->category_code,
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.category_code', $existing->category_code);
});

test('POST /api/categories — category_code를 명시하면 해당 코드로 생성된다', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories', [
        'category_name_ko' => '새카테고리',
        'category_code' => 'MY_CUSTOM_01',
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.category_code', 'MY_CUSTOM_01');
});

test('POST /api/categories — 빈 문자열 category_code는 자동 생성된다', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories', [
        'category_name_ko' => '새카테고리',
        'category_code' => '',
    ]);

    $response->assertCreated();
    $code = $response->json('data.category_code');
    expect($code)->toMatch('/^CAT_[a-z0-9]{8}$/');
});

test('POST /api/categories — category_code 미입력 시 자동 생성된다', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories', [
        'category_name_ko' => '새카테고리',
    ]);

    $response->assertCreated();
    $code = $response->json('data.category_code');
    expect($code)->toMatch('/^CAT_[a-z0-9]{8}$/');
});

test('GET /api/categories/levels — 파라미터 없이 대 목록을 반환한다', function () {
    Category::factory()->create(['category_name_ko' => '패션의류>여성의류>원피스']);
    Category::factory()->create(['category_name_ko' => '전자기기>스마트폰']);

    $response = $this->getJson('/api/categories/levels');

    $response->assertOk()
        ->assertJsonPath('data.options', ['패션의류', '전자기기'])
        ->assertJsonPath('data.maxDepth', 3)
        ->assertJsonPath('data.isLeaf', false);
});

test('GET /api/categories/levels — cat1 파라미터로 중 목록을 반환한다', function () {
    Category::factory()->create(['category_name_ko' => '패션의류>여성의류>원피스']);
    Category::factory()->create(['category_name_ko' => '패션의류>남성의류>셔츠']);

    $response = $this->getJson('/api/categories/levels?cat1='.urlencode('패션의류'));

    $response->assertOk()
        ->assertJsonPath('data.options', ['여성의류', '남성의류']);
});

test('GET /api/categories/levels — cat1+cat2 파라미터로 소 목록을 반환한다', function () {
    Category::factory()->create(['category_name_ko' => '패션의류>여성의류>원피스']);
    Category::factory()->create(['category_name_ko' => '패션의류>여성의류>블라우스']);

    $response = $this->getJson('/api/categories/levels?cat1='.urlencode('패션의류').'&cat2='.urlencode('여성의류'));

    $response->assertOk()
        ->assertJsonPath('data.options', ['원피스', '블라우스']);
});

test('GET /api/categories/levels — 리프 카테고리일 때 leafCategoryId를 반환한다', function () {
    $cat = Category::factory()->create(['category_name_ko' => '패션의류>여성의류>원피스']);

    $response = $this->getJson('/api/categories/levels?cat1='.urlencode('패션의류').'&cat2='.urlencode('여성의류').'&cat3='.urlencode('원피스'));

    $response->assertOk()
        ->assertJsonPath('data.isLeaf', true)
        ->assertJsonPath('data.leafCategoryId', $cat->id);
});

test('GET /api/categories/levels — max_depth 설정을 초과하는 깊이는 lastSegment로 포함한다', function () {
    config(['services.category.max_depth' => 3]);

    Category::factory()->create(['category_name_ko' => 'A>B>C>D>E']);

    $response = $this->getJson('/api/categories/levels?cat1=A&cat2=B');

    $response->assertOk();
    $options = $response->json('data.options');
    // 3단계(depth 2)에서의 옵션: compound option with label
    expect($options)->toHaveCount(1);
    expect($options[0])->toBeArray();
    expect($options[0]['label'])->toBe('C > D > E');
});

test('GET /api/categories/levels — 비로그인 사용자는 user_id=1 카테고리만 본다', function () {
    Category::factory()->create(['category_name_ko' => '공개>카테고리', 'user_id' => 1]);
    Category::factory()->create(['category_name_ko' => '비공개>카테고리', 'user_id' => 2]);

    $response = $this->getJson('/api/categories/levels');

    $response->assertOk()
        ->assertJsonPath('data.options', ['공개']);
});

test('GET /api/categories/levels — 기존 대 파라미터로 하위 호환 동작한다', function () {
    Category::factory()->create(['category_name_ko' => '패션의류>여성의류>원피스']);

    $response = $this->getJson('/api/categories/levels?'.http_build_query(['대' => '패션의류']));

    $response->assertOk()
        ->assertJsonPath('data.options', ['여성의류']);
});

test('GET /api/categories — page_number 파라미터로 페이지네이션이 동작한다', function () {
    Category::factory()->count(25)->create();

    $response = $this->getJson('/api/categories?page_number=2&page_size=10');

    $response->assertOk()
        ->assertJsonCount(10, 'data')
        ->assertJsonPath('meta.current_page', 2)
        ->assertJsonPath('meta.last_page', 3)
        ->assertJsonPath('meta.per_page', 10);
});

test('GET /api/categories — steps 파라미터 지정 시 일반 회원은 본인 소유 카테고리만 반환한다', function () {
    $user = User::factory()->create(['role' => 'member']);
    // user_id=1 (공개) 번역 미완료 카테고리
    Category::factory()->create([
        'user_id' => 1,
        'category_name_ko' => '공개카테고리',
        'category_name_en' => null,
    ]);
    // user (본인) 번역 미완료 카테고리
    $myCat = Category::factory()->create([
        'user_id' => $user->id,
        'category_name_ko' => '내카테고리',
        'category_name_en' => null,
    ]);

    // steps 미전달 시: 공개(1) + 본인($user->id) 모두 조회
    $resWithoutSteps = $this->actingAs($user, 'sanctum')->getJson('/api/categories?owner_scope=all');
    $resWithoutSteps->assertOk();
    expect($resWithoutSteps->json('data'))->toHaveCount(2);

    // steps 전달 시: 수정 권한이 있는 본인($user->id) 카테고리만 조회
    $resWithSteps = $this->actingAs($user, 'sanctum')->getJson('/api/categories?owner_scope=all&steps[]=translation.en');
    $resWithSteps->assertOk();
    expect($resWithSteps->json('data'))->toHaveCount(1);
    expect($resWithSteps->json('data.0.id'))->toBe($myCat->id);
});
