<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

#[Fillable(['user_id', 'name', 'key_hash', 'key_prefix', 'status'])]
class ApiKey extends Model
{
    /** @use HasFactory<ApiKeyFactory> */
    use HasFactory;

    public ?string $plain_key = null;

    /** JSON 직렬화에 포함할 추가 속성 */
    protected $appends = ['key_preview'];

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

    /**
     * 잘린 키 미리보기 (예: "cl_152|t9qk...")
     */
    protected function keyPreview(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->key_prefix ? $this->key_prefix.'...' : null,
        );
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
        return 'cl_'.Str::random(40);
    }

    public static function hashKey(string $key): string
    {
        return hash('sha256', $key);
    }
}
