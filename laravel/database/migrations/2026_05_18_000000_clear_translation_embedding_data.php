<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('categories')->update([
            'category_name_zh' => null,
            'category_name_en' => null,
        ]);
        DB::table('category_embeddings')->truncate();
        DB::table('translation_caches')->truncate();
    }

    public function down(): void
    {
        // 되돌릴 데이터 없음
    }
};
