<?php

namespace Database\Factories;

use App\Models\ApiKey;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ApiKeyFactory extends Factory
{
    protected $model = ApiKey::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'name' => fake()->word().' key',
            'key' => ApiKey::generateKey(),
            'status' => 'active',
        ];
    }

    public function paused(): static
    {
        return $this->state(fn (array $attributes): array => ['status' => 'paused']);
    }
}
