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
     * [Front-end URL Query Params Mapping]
     * - 'folder'          <= 'folder'
     * - 'text'            <= 'stext' (Similarity search input text)
     * - 'target_language' <= 'slang' (Similarity search translation target language)
     * - 'mode'            <= 'mode' (hierarchy or search)
     * - 'keyword'         <= 'q' or 'cat1>cat2>...'
     * - 'lang'            <= 'lang'  (Hierarchy select lang: ko, en, zh)
     * - 'page'            <= 'page'
     * - 'per_page'        <= 'per_page'
     * - 'filter'          <= 'filter'
     * - 'user_id'         <= 'user_id'
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'folder' => ['nullable', 'string', 'max:100'],
            'text' => ['nullable', 'string', 'max:500'],
            'target_language' => ['nullable', 'string', 'in:ko,en,zh'],
            'mode' => ['nullable', 'string', 'in:hierarchy,search'],
            'keyword' => ['nullable', 'string', 'max:500'],
            'lang' => ['nullable', 'string', 'in:ko,en,zh'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
            'filter' => ['nullable', 'string', 'in:my,all'],
            'user_id' => ['nullable', 'integer'],
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
