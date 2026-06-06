<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['api_key_id', 'source', 'source_label', 'user_id', 'endpoint', 'parameters', 'response_status', 'processing_time_ms'])]
class ApiUsageLog extends Model
{
    use HasFactory;

    public function apiKey(): BelongsTo
    {
        return $this->belongsTo(ApiKey::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return [
            'parameters' => 'array',
            'response_status' => 'integer',
            'processing_time_ms' => 'integer',
        ];
    }
}
