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
            $table->string('category_name_ko', 255)->nullable()->change();
        });
    }

    public function down(): void
    {
        DB::table('categories')->whereNull('category_name_ko')->update(['category_name_ko' => '']);
        Schema::table('categories', function (Blueprint $table) {
            $table->string('category_name_ko', 255)->nullable(false)->change();
        });
    }
};
