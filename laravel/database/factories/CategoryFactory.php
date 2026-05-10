<?php

namespace Database\Factories;

use App\Models\Category;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Category>
 */
class CategoryFactory extends Factory
{
    protected $model = Category::class;

    public function definition(): array
    {
        return [
            'category_code' => Category::generateCode(),
            'category_name_ko' => fake()->unique()->word(),
        ];
    }

    public function withZhName(): static
    {
        return $this->state(fn (array $attributes) => [
            'category_name_zh' => fake()->unique()->word(),
        ]);
    }

    public function withEnName(): static
    {
        return $this->state(fn (array $attributes) => [
            'category_name_en' => fake()->unique()->word(),
        ]);
    }
}
