<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CategoryStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'category_name_ko' => ['required', 'string', 'max:255'],
            'category_code' => ['nullable', 'string', 'max:255', 'unique:categories,category_code'],
        ];
    }
}
