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
