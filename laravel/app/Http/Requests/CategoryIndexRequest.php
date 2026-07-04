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
            'folder' => ['nullable', 'string', 'max:100'],
            'similarity_query' => ['nullable', 'string', 'max:500'],
            'translation_lang' => ['nullable', 'string', 'in:ko,en,zh'],
            'search_mode' => ['nullable', 'string', 'in:hierarchy,search'],
            'like_query' => ['nullable', 'string', 'max:500'],
            'hierarchy_lang' => ['nullable', 'string', 'in:ko,en,zh'],
            'page_number' => ['nullable', 'integer', 'min:1'],
            'page_size' => ['nullable', 'integer', 'min:1', 'max:'.config('services.pagination.max_per_page_guest', 100)],
            'owner_scope' => ['nullable', 'string', 'in:my,all'],
            'user_id' => ['nullable', 'integer'],
        ];
    }

    /**
     * Get the translation target language with a fallback to 'ko'.
     */
    public function getTranslationLang(): string
    {
        return $this->input('translation_lang') ?: 'ko';
    }
}
