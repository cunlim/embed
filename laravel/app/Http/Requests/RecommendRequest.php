<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RecommendRequest extends FormRequest
{
    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'text' => ['required', 'string', 'min:1', 'max:500'],
            'target_language' => ['required', 'string', 'in:ko,zh,en'],
        ];
    }
}
