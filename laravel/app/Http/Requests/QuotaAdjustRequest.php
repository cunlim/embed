<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class QuotaAdjustRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user('sanctum');

        return $user !== null && $user->isSuperAdmin();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', 'in:absolute,increment'],
            'value' => ['required', 'integer', function ($_, $value, $fail) {
                if ($this->input('type') === 'absolute' && $value < 0) {
                    $fail('절대값 설정은 0 이상이어야 합니다.');
                }
            }],
        ];
    }
}
