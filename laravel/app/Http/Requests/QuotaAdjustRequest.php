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
     * @return array<string, string>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', 'in:absolute,increment'],
            'value' => ['required', 'integer', 'min:0'],
        ];
    }
}
