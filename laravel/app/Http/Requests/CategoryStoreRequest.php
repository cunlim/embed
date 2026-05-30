<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CategoryStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'category_name_ko' => ['required', 'string', 'max:255'],
            'category_code' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique('categories', 'category_code')->where('user_id', $this->user()?->id ?? 1),
            ],
            'category_name_en' => ['nullable', 'string', 'max:255'],
            'category_name_zh' => ['nullable', 'string', 'max:255'],
            'folder' => ['nullable', 'string', 'max:100'],
        ];
    }
}
