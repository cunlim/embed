<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->integer('api_quota_remaining')->default(100)->after('role');
            $table->integer('api_quota_limit')->default(100)->after('api_quota_remaining');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['api_quota_remaining', 'api_quota_limit']);
        });
    }
};
