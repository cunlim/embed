<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ApiSearchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string|array>>
     */
    public function rules(): array
    {
        return [
            'folder' => ['nullable', 'string', 'max:100'],
            'similarity_query' => ['required', 'string', 'max:500'],
            'translation_lang' => ['nullable', 'string', 'in:ko,en,zh'],
            'search_mode' => ['nullable', 'string', 'in:hierarchy,search'],
            'like_query' => ['nullable', 'string', 'max:500'],
            'hierarchy_lang' => ['nullable', 'string', 'in:ko,en,zh'],
            'page_number' => ['nullable', 'integer', 'min:1'],
            'page_size' => ['nullable', 'integer', 'min:1', 'max:'.config('services.pagination.max_per_page_api', 50)],
        ];
    }
}
