<?php

namespace Database\Factories;

use App\Models\Category;
use App\Models\CategoryEmbedding;
use Illuminate\Database\Eloquent\Factories\Factory;
use Pgvector\Laravel\Vector;

/**
 * @extends Factory<CategoryEmbedding>
 */
class CategoryEmbeddingFactory extends Factory
{
    protected $model = CategoryEmbedding::class;

    public function definition(): array
    {
        return [
            'category_id' => Category::factory(),
            'language' => fake()->randomElement(['ko', 'zh', 'en']),
            'embed_model_name' => 'bge-m3:latest',
            'embedding' => new Vector($this->randomVector(1024)),
        ];
    }

    public function forLanguage(string $language): static
    {
        return $this->state(fn (array $attributes) => [
            'language' => $language,
        ]);
    }

    /**
     * @return array<int, float>
     */
    private function randomVector(int $dimensions): array
    {
        $vector = [];

        for ($i = 0; $i < $dimensions; $i++) {
            $vector[] = fake()->randomFloat(6, -1, 1);
        }

        return $vector;
    }
}
