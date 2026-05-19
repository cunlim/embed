<?php

namespace App\Models;

use Database\Factories\SearchLogFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Pgvector\Laravel\Vector;

#[Fillable(['user_id', 'search_keyword', 'embed_model_name', 'embedding', 'normalized_keyword'])]
#[Hidden(['id', 'created_at', 'updated_at', 'embedding'])]
class SearchLog extends Model
{
    /** @use HasFactory<SearchLogFactory> */
    use HasFactory;

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
            'user_id' => 'integer',
            'embedding' => Vector::class,
        ];
    }
}
