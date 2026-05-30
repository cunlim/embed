<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class FolderDeleteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'move_to_default' => ['nullable', 'boolean'],
        ];
    }
}
