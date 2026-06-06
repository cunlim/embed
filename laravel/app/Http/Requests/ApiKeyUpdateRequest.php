<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ApiKeyUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $userId = auth('sanctum')->id();

        return [
            'name' => [
                'sometimes',
                'string',
                'max:100',
                Rule::unique('api_keys', 'name')
                    ->where('user_id', $userId)
                    ->ignore($this->route('id')),
            ],
            'status' => ['sometimes', 'in:active,paused'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.unique' => '이미 사용 중인 API key 이름입니다.',
        ];
    }
}
