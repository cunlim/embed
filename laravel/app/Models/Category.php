<?php

namespace App\Models;

use Database\Factories\CategoryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

#[Fillable(['category_code', 'category_name_ko', 'category_name_zh', 'category_name_en'])]
#[Hidden(['id', 'created_at', 'updated_at'])]
class Category extends Model
{
    /** @use HasFactory<CategoryFactory> */
    use HasFactory;

    /**
     * @return HasMany<CategoryEmbedding>
     */
    public function categoryEmbeddings(): HasMany
    {
        return $this->hasMany(CategoryEmbedding::class);
    }

    protected function casts(): array
    {
        return [
            'id' => 'integer',
        ];
    }

    public static function generateCode(): string
    {
        $maxAttempts = 3;

        for ($attempt = 0; $attempt < $maxAttempts; $attempt++) {
            $code = 'CAT_'.Str::lower(Str::random(8));

            if (! static::where('category_code', $code)->exists()) {
                return $code;
            }
        }

        throw new \RuntimeException('범주 코드 생성 실패: '.$maxAttempts.'회 시도 후에도 고유 코드를 생성할 수 없습니다.');
    }
}
