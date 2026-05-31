<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RecommendRequest extends FormRequest
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
            'text' => ['nullable', 'string', 'max:500'],
            'target_language' => ['required', 'string', 'in:ko,zh,en'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'filter' => ['nullable', 'string', 'in:my,all'],
            'keyword' => ['nullable', 'string', 'max:500'],
            'folder' => ['nullable', 'string', 'max:100'],
        ];
    }
}
