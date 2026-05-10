<?php

namespace App\Models;

use Database\Factories\TranslationCacheFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['source_text', 'target_lang', 'translated_text'])]
class TranslationCache extends Model
{
    /** @use HasFactory<TranslationCacheFactory> */
    use HasFactory;

    protected $table = 'translation_cache';

    protected function casts(): array
    {
        return [
            'id' => 'integer',
        ];
    }
}
