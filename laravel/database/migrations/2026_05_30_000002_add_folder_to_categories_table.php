<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // folder 컬럼 추가
        Schema::table('categories', function (Blueprint $table) {
            $table->string('folder', 100)->nullable()->default(null)->after('user_id');
        });

        // 기존 복합 unique 인덱스 제거
        $hasCompositeUnique = DB::selectOne(
            "SELECT 1 FROM pg_indexes WHERE indexname = 'categories_category_code_user_id_unique'"
        );
        if ($hasCompositeUnique) {
            Schema::table('categories', function (Blueprint $table) {
                $table->dropUnique('categories_category_code_user_id_unique');
            });
        }

        // COALESCE 기반 partial unique 인덱스 추가 (NULL 처리)
        DB::statement(
            'CREATE UNIQUE INDEX categories_code_user_folder_unique ON categories (category_code, user_id, COALESCE(folder, \'\'))'
        );
    }

    public function down(): void
    {
        // partial unique 인덱스 제거
        DB::statement('DROP INDEX IF EXISTS categories_code_user_folder_unique');

        // 기존 복합 unique 인덱스 복원
        Schema::table('categories', function (Blueprint $table) {
            $table->unique(['category_code', 'user_id']);
        });

        // folder 컬럼 제거
        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn('folder');
        });
    }
};
