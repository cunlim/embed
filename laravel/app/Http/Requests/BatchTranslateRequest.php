<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BatchTranslateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, string>
     */
    public function rules(): array
    {
        return [
            'target_language' => ['required', 'string', 'in:ko,zh,en'],
        ];
    }
}
