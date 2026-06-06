<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * (user_id, name) 복합 유니크 인덱스를 추가한다.
     */
    public function up(): void
    {
        // 기존 중복 데이터 정리: 같은 사용자 내 동일 이름 키는 가장 오래된 것만 남기고 삭제
        DB::statement('
            DELETE FROM api_keys
            WHERE id IN (
                SELECT id FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY user_id, name
                               ORDER BY created_at ASC
                           ) AS rn
                    FROM api_keys
                ) AS ranked
                WHERE rn > 1
            )
        ');

        Schema::table('api_keys', function (Blueprint $table) {
            $table->unique(['user_id', 'name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('api_keys', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'name']);
        });
    }
};
