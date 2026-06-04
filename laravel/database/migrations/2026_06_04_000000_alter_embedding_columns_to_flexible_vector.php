<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * category_embeddings.embedding과 search_logs.embedding을
     * vector(1024)에서 차원 제한 없는 vector로 변경한다.
     */
    public function up(): void
    {
        DB::statement('ALTER TABLE category_embeddings ALTER COLUMN embedding TYPE vector');
        DB::statement('ALTER TABLE search_logs ALTER COLUMN embedding TYPE vector');
    }

    /**
     * Reverse the migrations.
     *
     * vector(1024)로 되돌린다.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE category_embeddings ALTER COLUMN embedding TYPE vector(1024)');
        DB::statement('ALTER TABLE search_logs ALTER COLUMN embedding TYPE vector(1024)');
    }
};
