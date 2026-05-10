<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\CategoryEmbedding;
use Illuminate\Database\Seeder;
use Pgvector\Laravel\Vector;

class CategoryEmbeddingSeeder extends Seeder
{
    public function run(): void
    {
        $categories = Category::all();

        foreach ($categories as $category) {
            foreach (['ko', 'zh', 'en'] as $lang) {
                CategoryEmbedding::create([
                    'category_id' => $category->id,
                    'language' => $lang,
                    'embed_model_name' => 'bge-m3:latest',
                    'embedding' => new Vector($this->randomUnitVector(1024)),
                ]);
            }
        }
    }

    /**
     * @return array<int, float>
     */
    private function randomUnitVector(int $dimensions): array
    {
        $vector = [];
        $sumOfSquares = 0;

        for ($i = 0; $i < $dimensions; $i++) {
            $value = (mt_rand() / mt_getrandmax()) * 2 - 1;
            $vector[] = $value;
            $sumOfSquares += $value * $value;
        }

        $magnitude = sqrt($sumOfSquares);

        return array_map(fn (float $v) => $v / $magnitude, $vector);
    }
}
