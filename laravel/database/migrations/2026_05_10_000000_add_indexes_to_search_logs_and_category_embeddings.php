<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('search_logs', function (Blueprint $table) {
            // 캐시 조회 성능: session_id 기준 검색 최적화
            $table->index('session_id');
        });

        Schema::table('category_embeddings', function (Blueprint $table) {
            // pgvector 유사도 검색 시 language 필터 성능 최적화
            $table->index('language');
        });
    }

    public function down(): void
    {
        Schema::table('search_logs', function (Blueprint $table) {
            $table->dropIndex(['session_id']);
        });

        Schema::table('category_embeddings', function (Blueprint $table) {
            $table->dropIndex(['language']);
        });
    }
};
