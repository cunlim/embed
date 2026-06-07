<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('api_keys', function (Blueprint $table) {
            $table->string('key_hash', 64)->nullable()->after('key');
            $table->string('key_prefix', 10)->nullable()->after('key_hash');
        });

        // 기존 평문 키를 해시로 변환
        foreach (DB::table('api_keys')->select(['id', 'key'])->cursor() as $row) {
            DB::table('api_keys')
                ->where('id', $row->id)
                ->update([
                    'key_hash' => hash('sha256', $row->key),
                    'key_prefix' => substr($row->key, 0, 10),
                ]);
        }

        // 인덱스 추가 + NOT NULL 제약
        Schema::table('api_keys', function (Blueprint $table) {
            $table->string('key_hash', 64)->nullable(false)->change();
            $table->index('key_hash');
        });
    }

    public function down(): void
    {
        Schema::table('api_keys', function (Blueprint $table) {
            $table->dropIndex(['key_hash']);
            $table->dropColumn(['key_hash', 'key_prefix']);
        });
    }
};
