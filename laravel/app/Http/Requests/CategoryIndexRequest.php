<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class CategoryIndexRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'text' => ['nullable', 'string', 'max:500'],
            'target_language' => ['nullable', 'string', 'in:ko,en,zh'],
            'lang' => ['nullable', 'string', 'in:ko,en,zh'],
            'per_page' => ['nullable', 'integer', 'min:1'],
            'page' => ['nullable', 'integer', 'min:1'],
            'keyword' => ['nullable', 'string', 'max:500'],
            'folder' => ['nullable', 'string', 'max:100'],
            'filter' => ['nullable', 'string', 'in:my,all'],
            'user_id' => ['nullable', 'integer'],
            'mode' => ['nullable', 'string', 'in:hierarchy,search'],
        ];
    }

    /**
     * Get the target language with a fallback to 'ko'.
     */
    public function getTargetLanguage(): string
    {
        return $this->input('target_language') ?: 'ko';
    }
}
