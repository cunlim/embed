<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [];

        foreach ($categories as $cat) {
            Category::create([
                'category_code' => Category::generateCode(1),
                'category_name_ko' => $cat['category_name_ko'],
                'category_name_zh' => $cat['category_name_zh'],
                'category_name_en' => $cat['category_name_en'],
                'user_id' => 1,
            ]);
        }
    }
}
