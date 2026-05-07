<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('search_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->uuid('session_id');
            $table->text('search_keyword');
            $table->string('embed_model_name', 100);
            $table->timestamps();
        });

        DB::statement('ALTER TABLE search_logs ADD COLUMN embedding vector(768)');
    }

    public function down(): void
    {
        Schema::dropIfExists('search_logs');
    }
};
