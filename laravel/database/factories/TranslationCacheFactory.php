<?php

namespace Database\Factories;

use App\Models\TranslationCache;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TranslationCache>
 */
class TranslationCacheFactory extends Factory
{
    protected $model = TranslationCache::class;

    public function definition(): array
    {
        $sourceText = fake()->sentence();

        return [
            'source_text' => $sourceText,
            'target_lang' => fake()->randomElement(['zh', 'en']),
            'translated_text' => fake()->sentence(),
        ];
    }
}
