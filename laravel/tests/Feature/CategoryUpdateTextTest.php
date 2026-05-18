<?php

use App\Http\Requests\CategoryUpdateTextRequest;
use Illuminate\Support\Facades\Validator;

it('유효한 field와 value를 허용한다', function () {
    $validator = Validator::make(
        ['field' => 'category_name_en', 'value' => 'New Name'],
        (new CategoryUpdateTextRequest)->rules()
    );
    expect($validator->passes())->toBeTrue();
});

it('유효하지 않은 field를 거부한다', function () {
    $validator = Validator::make(
        ['field' => 'invalid_field', 'value' => 'test'],
        (new CategoryUpdateTextRequest)->rules()
    );
    expect($validator->fails())->toBeTrue();
});

it('null value를 허용한다', function () {
    $validator = Validator::make(
        ['field' => 'category_name_en', 'value' => null],
        (new CategoryUpdateTextRequest)->rules()
    );
    expect($validator->passes())->toBeTrue();
});

it('255자를 초과하는 value를 거부한다', function () {
    $validator = Validator::make(
        ['field' => 'category_name_ko', 'value' => str_repeat('가', 256)],
        (new CategoryUpdateTextRequest)->rules()
    );
    expect($validator->fails())->toBeTrue();
});

it('field가 누락되면 유효성 검증에 실패한다', function () {
    $validator = Validator::make(
        ['value' => 'test'],
        (new CategoryUpdateTextRequest)->rules()
    );
    expect($validator->fails())->toBeTrue();
    expect($validator->errors()->has('field'))->toBeTrue();
});

it('유효하지 않은 field에 대해 한글 오류 메시지를 반환한다', function () {
    $request = new CategoryUpdateTextRequest;
    $validator = Validator::make(
        ['field' => 'invalid_field', 'value' => 'test'],
        $request->rules(),
        $request->messages()
    );
    $messages = $validator->messages()->get('field');
    expect($messages[0])->toContain('유효하지 않은 필드');
});

// ----------------------------------------------------------------
// Controller Feature Tests
// ----------------------------------------------------------------

use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->token = $this->user->createToken('test')->plainTextToken;
});

it('인증 없이 요청하면 401을 반환한다', function () {
    $category = Category::factory()->create();
    $response = $this->putJson("/api/categories/{$category->id}/update-text", [
        'field' => 'category_name_en',
        'value' => 'New Name',
    ]);
    $response->assertStatus(401);
});

it('카테고리 텍스트를 업데이트하고 임베딩을 삭제한다', function () {
    $category = Category::factory()->create([
        'category_name_ko' => '원본',
        'category_name_en' => 'Old Name',
    ]);
    // embedding 생성 (삭제 확인용)
    CategoryEmbedding::factory()->create([
        'category_id' => $category->id,
        'language' => 'en',
    ]);
    CategoryEmbedding::factory()->create([
        'category_id' => $category->id,
        'language' => 'ko',
    ]);

    $response = $this->withToken($this->token)
        ->putJson("/api/categories/{$category->id}/update-text", [
            'field' => 'category_name_en',
            'value' => 'New English Name',
        ]);

    $response->assertOk();
    $response->assertJson(['data' => ['updated' => true, 'id' => $category->id]]);
    $response->assertJsonStructure([
        'data' => [
            'translations' => [
                'id', 'category_code', 'category_name_ko', 'languages',
            ],
            'listRow' => [
                'id', 'category_name_ko', 'translation_status',
            ],
        ],
    ]);

    $this->assertDatabaseHas('categories', [
        'id' => $category->id,
        'category_name_en' => 'New English Name',
    ]);
    $this->assertDatabaseMissing('category_embeddings', [
        'category_id' => $category->id,
        'language' => 'en',
    ]);
    $this->assertDatabaseHas('category_embeddings', [
        'category_id' => $category->id,
        'language' => 'ko',
    ]);
});

it('value를 null로 업데이트할 수 있다', function () {
    $category = Category::factory()->create([
        'category_name_en' => 'Old Name',
    ]);

    $response = $this->withToken($this->token)
        ->putJson("/api/categories/{$category->id}/update-text", [
            'field' => 'category_name_en',
            'value' => null,
        ]);

    $response->assertOk();
    $response->assertJsonStructure([
        'data' => [
            'translations' => ['id', 'languages'],
            'listRow' => ['id', 'translation_status'],
        ],
    ]);
    $this->assertDatabaseHas('categories', [
        'id' => $category->id,
        'category_name_en' => null,
    ]);
});

it('존재하지 않는 카테고리에 404를 반환한다', function () {
    $response = $this->withToken($this->token)
        ->putJson('/api/categories/99999/update-text', [
            'field' => 'category_name_ko',
            'value' => 'New',
        ]);
    $response->assertStatus(404);
});
