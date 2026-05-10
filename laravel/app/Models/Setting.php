<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['group', 'key', 'value', 'type', 'description'])]
class Setting extends Model
{
    protected function casts(): array
    {
        return [
            'id' => 'integer',
        ];
    }
}
