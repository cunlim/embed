<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CategoryUpdateTextRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'field' => ['required', 'string', 'in:category_name_ko,category_name_en,category_name_zh,category_code'],
            'value' => ['nullable', 'string', 'max:255'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'field.in' => '유효하지 않은 필드입니다. (category_name_ko, category_name_en, category_name_zh, category_code 중 하나)',
            'value.max' => '값은 255자를 초과할 수 없습니다.',
        ];
    }
}
