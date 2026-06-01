<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CategoryStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        // admin이 특정 회원의 user_id를 지정한 경우 해당 회원 기준으로 unique 검증
        $user = $this->user();
        $uniqueUserId = ($user && $user->isAdmin() && $this->filled('user_id'))
            ? (int) $this->input('user_id')
            : ($user?->id ?? 1);

        return [
            'category_name_ko' => ['required', 'string', 'max:255'],
            'category_code' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique('categories', 'category_code')
                    ->where('user_id', $uniqueUserId)
                    ->where('folder', $this->input('folder') ?: null),
            ],
            'category_name_en' => ['nullable', 'string', 'max:255'],
            'category_name_zh' => ['nullable', 'string', 'max:255'],
            'folder' => ['nullable', 'string', 'max:100'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
        ];
    }
}
