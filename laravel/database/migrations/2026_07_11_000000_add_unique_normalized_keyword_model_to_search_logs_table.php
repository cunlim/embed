<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * (normalized_keyword, embed_model_name) 복합 유니크 인덱스를 추가한다.
     *
     * updateOrCreate 의 lookup 키 보호 + 중복 캐시 row 방지.
     * PostgreSQL 에서 NULL 은 서로 다른 값으로 취급되므로,
     * normalized_keyword 가 NULL 이 아닌 row 에만 유니크 제약이 실질적으로 적용된다.
     */
    public function up(): void
    {
        // 기존 중복 데이터 정리: 같은 (normalized_keyword, embed_model_name) 조합에서
        // 가장 오래된 row 만 남기고 나머지는 삭제
        DB::statement('
            DELETE FROM search_logs
            WHERE id IN (
                SELECT id FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY normalized_keyword, embed_model_name
                               ORDER BY created_at ASC
                           ) AS rn
                    FROM search_logs
                    WHERE normalized_keyword IS NOT NULL
                ) AS ranked
                WHERE rn > 1
            )
        ');

        Schema::table('search_logs', function (Blueprint $table) {
            $table->unique(['normalized_keyword', 'embed_model_name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('search_logs', function (Blueprint $table) {
            $table->dropUnique(['normalized_keyword', 'embed_model_name']);
        });
    }
};
