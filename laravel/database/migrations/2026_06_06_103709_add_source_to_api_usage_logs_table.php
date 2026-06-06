<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('api_usage_logs', function (Blueprint $table) {
            $table->string('source', 20)->default('api_key')->after('api_key_id');
            $table->string('source_label', 100)->nullable()->after('source');
        });
    }

    public function down(): void
    {
        Schema::table('api_usage_logs', function (Blueprint $table) {
            $table->dropColumn(['source', 'source_label']);
        });
    }
};
