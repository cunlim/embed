<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApiUsageLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'api_key_id',
        'user_id',
        'endpoint',
        'parameters',
        'response_status',
        'processing_time_ms',
    ];

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
