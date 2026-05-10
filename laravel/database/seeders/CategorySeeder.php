<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['category_name_ko' => '패션의류', 'category_name_zh' => '时尚服装', 'category_name_en' => 'Fashion Clothing'],
            ['category_name_ko' => '패션잡화', 'category_name_zh' => '时尚杂货', 'category_name_en' => 'Fashion Accessories'],
            ['category_name_ko' => '화장품/미용', 'category_name_zh' => '化妆品/美容', 'category_name_en' => 'Cosmetics/Beauty'],
            ['category_name_ko' => '디지털/가전', 'category_name_zh' => '数码/家电', 'category_name_en' => 'Digital/Electronics'],
            ['category_name_ko' => '가구/인테리어', 'category_name_zh' => '家具/室内装饰', 'category_name_en' => 'Furniture/Interior'],
            ['category_name_ko' => '출산/육아', 'category_name_zh' => '分娩/育儿', 'category_name_en' => 'Maternity/Childcare'],
            ['category_name_ko' => '식품', 'category_name_zh' => '食品', 'category_name_en' => 'Food'],
            ['category_name_ko' => '스포츠/레저', 'category_name_zh' => '体育/休闲', 'category_name_en' => 'Sports/Leisure'],
            ['category_name_ko' => '도서/티켓/취미', 'category_name_zh' => '图书/票务/爱好', 'category_name_en' => 'Books/Tickets/Hobbies'],
            ['category_name_ko' => '반려동물용품', 'category_name_zh' => '宠物用品', 'category_name_en' => 'Pet Supplies'],
        ];

        foreach ($categories as $cat) {
            Category::create([
                'category_code' => Category::generateCode(),
                'category_name_ko' => $cat['category_name_ko'],
                'category_name_zh' => $cat['category_name_zh'],
                'category_name_en' => $cat['category_name_en'],
            ]);
        }
    }
}
