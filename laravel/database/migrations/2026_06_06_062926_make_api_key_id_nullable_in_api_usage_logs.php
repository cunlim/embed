<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * api_key 삭제 시 사용 로그는 보존하고 api_key_id만 NULL로 설정한다.
     * (이전 동작: FK cascade로 사용 로그 자체가 영구 삭제되어 차트·이력 소실)
     */
    public function up(): void
    {
        Schema::table('api_usage_logs', function (Blueprint $table) {
            $table->dropForeign(['api_key_id']);
            $table->foreignId('api_key_id')->nullable()->change()->constrained()->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('api_usage_logs', function (Blueprint $table) {
            $table->dropForeign(['api_key_id']);
            $table->foreignId('api_key_id')->nullable(false)->change()->constrained()->onDelete('cascade');
        });
    }
};
