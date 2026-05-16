<?php

namespace App\Models;

use Database\Factories\CategoryEmbeddingFactory;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Pgvector\Laravel\Vector;

#[Hidden(['id', 'created_at', 'updated_at'])]
class CategoryEmbedding extends Model
{
    /** @use HasFactory<CategoryEmbeddingFactory> */
    use HasFactory;

    protected $fillable = [
        'category_id',
        'language',
        'embed_model_name',
        'embedding',
    ];

    /**
     * @return BelongsTo<Category, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * pgvector cosine distance(<=>) 연산자를 사용한 유사 임베딩 검색 스코프.
     *
     * @param  float[]  $vector  1024차원 쿼리 벡터
     * @param  string  $language  언어 코드
     * @param  int  $limit  결과 제한
     */
    public function scopeSimilarTo(Builder $query, array $vector, string $language, int $limit = 5): Builder
    {
        $vectorLiteral = '['.implode(',', $vector).']';

        return $query
            ->selectRaw('*, embedding <=> ?::vector as distance', [$vectorLiteral])
            ->where('language', $language)
            ->orderByRaw('embedding <=> ?::vector', [$vectorLiteral])
            ->limit($limit);
    }

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'category_id' => 'integer',
            'embedding' => Vector::class,
        ];
    }
}
