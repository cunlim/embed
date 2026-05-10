<?php

namespace App\Models;

use Database\Factories\SearchLogFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Pgvector\Laravel\Vector;

#[Fillable(['user_id', 'session_id', 'search_keyword', 'embed_model_name', 'embedding', 'normalized_keyword'])]
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

    protected static function booted(): void
    {
        static::creating(function (self $model) {
            if (empty($model->session_id)) {
                $model->session_id = (string) Str::uuid();
            }
        });
    }
}
