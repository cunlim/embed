<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 기존 전역 unique 제약조건 제거 (존재할 때만)
        $hasGlobalUnique = DB::selectOne(
            "SELECT 1 FROM pg_indexes WHERE indexname = 'categories_category_code_unique'"
        );

        if ($hasGlobalUnique) {
            Schema::table('categories', function (Blueprint $table) {
                $table->dropUnique('categories_category_code_unique');
            });
        }

        // category_code + user_id 복합 unique 인덱스 추가 (이미 존재하면 스킵)
        $hasCompositeUnique = DB::selectOne(
            "SELECT 1 FROM pg_indexes WHERE indexname = 'categories_category_code_user_id_unique'"
        );

        if (! $hasCompositeUnique) {
            Schema::table('categories', function (Blueprint $table) {
                $table->unique(['category_code', 'user_id']);
            });
        }
    }

    public function down(): void
    {
        // 복합 unique 제거
        Schema::table('categories', function (Blueprint $table) {
            $table->dropUnique(['category_code', 'user_id']);
        });

        // 전역 unique 복원
        Schema::table('categories', function (Blueprint $table) {
            $table->unique('category_code');
        });
    }
};
