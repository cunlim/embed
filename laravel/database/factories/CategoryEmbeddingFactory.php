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
    private const DEFAULT_DIMENSIONS = 1024;

    protected $model = CategoryEmbedding::class;

    public function definition(): array
    {
        return [
            'category_id' => Category::factory(),
            'language' => fake()->randomElement(['ko', 'zh', 'en']),
            'embed_model_name' => 'bge-m3:latest',
            'embedding' => new Vector($this->randomUnitVector(self::DEFAULT_DIMENSIONS)),
        ];
    }

    public function forLanguage(string $language): static
    {
        return $this->state(fn (array $attributes) => [
            'language' => $language,
        ]);
    }

    /**
     * Box-Muller 변환으로 Gaussian 분포에서 샘플링 후 정규화하여 구면 위 균등 분포 벡터를 생성한다.
     *
     * @return array<int, float>
     */
    private function randomUnitVector(int $dimensions): array
    {
        $vector = [];
        $sumOfSquares = 0;

        for ($i = 0; $i < $dimensions; $i += 2) {
            do {
                $u1 = mt_rand() / mt_getrandmax();
            } while ($u1 == 0.0);
            $u2 = mt_rand() / mt_getrandmax();

            $r = sqrt(-2.0 * log($u1));
            $z0 = $r * cos(2.0 * M_PI * $u2);
            $z1 = $r * sin(2.0 * M_PI * $u2);

            $vector[] = $z0;
            $sumOfSquares += $z0 * $z0;

            if ($i + 1 < $dimensions) {
                $vector[] = $z1;
                $sumOfSquares += $z1 * $z1;
            }
        }

        $magnitude = sqrt($sumOfSquares);

        return array_map(fn (float $v) => $v / $magnitude, $vector);
    }
}
