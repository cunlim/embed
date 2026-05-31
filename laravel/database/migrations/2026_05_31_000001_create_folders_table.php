<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. folders 테이블 생성
        Schema::create('folders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('name', 100);
            $table->timestamps();

            $table->unique(['user_id', 'name']);
        });

        // 2. 기존 categories에서 폴더 데이터 마이그레이션
        $folders = DB::table('categories')
            ->whereNotNull('folder')
            ->where('category_name_ko', '!=', '__folder_placeholder__')
            ->select('user_id', 'folder')
            ->distinct()
            ->get();

        foreach ($folders as $f) {
            DB::table('folders')->insertOrIgnore([
                'user_id' => $f->user_id,
                'name' => $f->folder,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // 3. placeholder 더미 카테고리 삭제
        DB::table('categories')
            ->where('category_name_ko', '__folder_placeholder__')
            ->delete();
    }

    public function down(): void
    {
        // placeholder 복원 (폴더별 1개씩)
        $folders = DB::table('folders')->get();
        foreach ($folders as $f) {
            DB::table('categories')->insert([
                'user_id' => $f->user_id,
                'category_name_ko' => '__folder_placeholder__',
                'folder' => $f->name,
                'created_at' => $f->created_at,
                'updated_at' => $f->updated_at,
            ]);
        }

        Schema::dropIfExists('folders');
    }
};
