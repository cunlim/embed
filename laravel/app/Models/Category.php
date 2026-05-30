<?php

namespace App\Models;

use Database\Factories\CategoryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

#[Fillable(['category_code', 'category_name_ko', 'category_name_zh', 'category_name_en', 'user_id', 'folder'])]
#[Hidden(['id', 'created_at', 'updated_at'])]
class Category extends Model
{
    /** @use HasFactory<CategoryFactory> */
    use HasFactory;

    /**
     * @return HasMany<CategoryEmbedding>
     */
    public function embeddings(): HasMany
    {
        return $this->hasMany(CategoryEmbedding::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return [
            'id' => 'integer',
        ];
    }

    public static function generateCode(int $userId): string
    {
        $prefix = config('services.category.code_prefix', 'CAT_');
        $length = (int) config('services.category.code_random_length', 8);
        $maxAttempts = (int) config('services.category.code_max_attempts', 3);

        for ($attempt = 0; $attempt < $maxAttempts; $attempt++) {
            $code = $prefix.Str::lower(Str::random($length));

            if (! static::where('category_code', $code)->where('user_id', $userId)->exists()) {
                return $code;
            }
        }

        throw new \RuntimeException('범주 코드 생성 실패: '.$maxAttempts.'회 시도 후에도 고유 코드를 생성할 수 없습니다.');
    }
}
