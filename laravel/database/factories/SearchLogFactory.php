<?php

namespace Database\Factories;

use App\Models\SearchLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;
use Pgvector\Laravel\Vector;

/**
 * @extends Factory<SearchLog>
 */
class SearchLogFactory extends Factory
{
    protected $model = SearchLog::class;

    public function definition(): array
    {
        $keyword = fake()->word();

        return [
            'user_id' => null,
            'session_id' => (string) Str::uuid(),
            'search_keyword' => $keyword,
            'normalized_keyword' => mb_strtolower(trim($keyword)),
            'embed_model_name' => 'bge-m3:latest',
            'embedding' => new Vector($this->randomVector(1024)),
        ];
    }

    public function forUser(User $user): static
    {
        return $this->state(fn (array $attributes) => [
            'user_id' => $user->id,
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
