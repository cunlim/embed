<?php

namespace App\Models;

use Database\Factories\CategoryEmbeddingFactory;
use Illuminate\Database\Eloquent\Attributes\Hidden;
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

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'category_id' => 'integer',
            'embedding' => Vector::class,
        ];
    }
}
