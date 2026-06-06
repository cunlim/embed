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
            'text' => ['required', 'string', 'max:500'],
            'target_language' => ['nullable', 'string', 'in:ko,zh,en'],
            'mode' => ['nullable', 'string', 'in:hierarchy,search'],
            'keyword' => ['nullable', 'string', 'max:500'],
            'lang' => ['nullable', 'string', 'in:ko,zh,en'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ];
    }
}
