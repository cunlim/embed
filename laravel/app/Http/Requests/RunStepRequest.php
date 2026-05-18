<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RunStepRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'step' => ['required', 'string', 'in:translation.zh,translation.en,embedding.ko,embedding.zh,embedding.en'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'step.in' => '유효하지 않은 step입니다. (translation.zh, translation.en, embedding.ko, embedding.zh, embedding.en 중 하나)',
        ];
    }
}
