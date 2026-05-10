<?php

namespace Database\Seeders;

use App\Models\SearchLog;
use Illuminate\Database\Seeder;

class SearchLogSeeder extends Seeder
{
    public function run(): void
    {
        // Factory로 샘플 검색 로그 생성
        SearchLog::factory(5)->create();
    }
}
