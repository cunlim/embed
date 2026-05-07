<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('translation_cache', function (Blueprint $table) {
            $table->id();
            $table->text('source_text');
            $table->string('target_lang', 10);
            $table->text('translated_text');
            $table->unique(['source_text', 'target_lang']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('translation_cache');
    }
};
