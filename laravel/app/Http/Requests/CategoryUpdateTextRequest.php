<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CategoryUpdateTextRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $rules = [
            'field' => ['required', 'string', 'in:category_name_ko,category_name_en,category_name_zh,category_code'],
            'value' => ['nullable', 'string', 'max:255'],
        ];

        // category_code 업데이트 시 사용자+폴더별 유일성 검증
        if ($this->input('field') === 'category_code') {
            $rules['value'][] = Rule::unique('categories', 'category_code')
                ->where('user_id', $this->user()?->id ?? 1)
                ->where('folder', $this->input('folder') ?: null)
                ->ignore($this->route('category')?->id);
        }

        return $rules;
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'field.in' => '유효하지 않은 필드입니다. (category_name_ko, category_name_en, category_name_zh, category_code 중 하나)',
            'value.max' => '값은 255자를 초과할 수 없습니다.',
            'value.unique' => '이미 사용 중인 카테고리 코드입니다.',
        ];
    }
}
