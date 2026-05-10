<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('search_logs', function (Blueprint $table) {
            // 캐시 매칭용 정규화된 키워드 (앞뒤 공백 제거, 연속 공백 단일화, 영어 소문자화)
            $table->string('normalized_keyword', 500)->nullable()->after('search_keyword');
            $table->index('normalized_keyword');
        });
    }

    public function down(): void
    {
        Schema::table('search_logs', function (Blueprint $table) {
            $table->dropIndex(['normalized_keyword']);
            $table->dropColumn('normalized_keyword');
        });
    }
};
