<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class ApiKey extends Model
{
    /** @use HasFactory<ApiKeyFactory> */
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'key',
        'status',
    ];

    protected $hidden = [
        'key',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function usageLogs(): HasMany
    {
        return $this->hasMany(ApiUsageLog::class);
    }

    protected function casts(): array
    {
        return [
            'last_used_at' => 'datetime',
        ];
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isPaused(): bool
    {
        return $this->status === 'paused';
    }

    public static function generateKey(): string
    {
        return 'cl_' . Str::random(40);
    }
}
