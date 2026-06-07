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
        $key = ApiKey::generateKey();

        return [
            'user_id' => User::factory(),
            'name' => fake()->word().' key',
            'key' => $key,
            'key_hash' => ApiKey::hashKey($key),
            'key_prefix' => substr($key, 0, 10),
            'status' => 'active',
        ];
    }

    public function paused(): static
    {
        return $this->state(fn (array $attributes): array => ['status' => 'paused']);
    }
}
