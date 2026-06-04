<?php

namespace Database\Factories;

use App\Models\ApiKey;
use App\Models\ApiUsageLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ApiUsageLogFactory extends Factory
{
    protected $model = ApiUsageLog::class;

    public function definition(): array
    {
        return [
            'api_key_id' => ApiKey::factory(),
            'user_id' => User::factory(),
            'endpoint' => '/api/v1/search',
            'parameters' => ['text' => '청바지', 'target_language' => 'ko'],
            'response_status' => 200,
            'processing_time_ms' => fake()->numberBetween(50, 500),
        ];
    }
}
