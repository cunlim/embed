<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('category_embeddings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->string('language', 10);
            $table->string('embed_model_name', 100);
            $table->unique(['category_id', 'language', 'embed_model_name']);
            $table->timestamps();
        });

        DB::statement('ALTER TABLE category_embeddings ADD COLUMN embedding vector(768)');
    }

    public function down(): void
    {
        Schema::dropIfExists('category_embeddings');
    }
};
