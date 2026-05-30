<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->nullable()->after('id');
        });

        // 기존 모든 카테고리를 user_id=1로 백필
        DB::table('categories')->whereNull('user_id')->update(['user_id' => 1]);

        // category_code + user_id 복합 유니크 인덱스 추가
        Schema::table('categories', function (Blueprint $table) {
            $table->unique(['category_code', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn('user_id');
        });
    }
};
