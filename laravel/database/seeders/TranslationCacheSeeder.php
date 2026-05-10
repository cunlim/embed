<?php

namespace Database\Seeders;

use App\Models\TranslationCache;
use Illuminate\Database\Seeder;

class TranslationCacheSeeder extends Seeder
{
    public function run(): void
    {
        $entries = [
            ['source_text' => '패션의류', 'target_lang' => 'en', 'translated_text' => 'Fashion Clothing'],
            ['source_text' => '패션의류', 'target_lang' => 'zh', 'translated_text' => '时尚服装'],
            ['source_text' => '디지털/가전', 'target_lang' => 'en', 'translated_text' => 'Digital/Electronics'],
            ['source_text' => '디지털/가전', 'target_lang' => 'zh', 'translated_text' => '数码/家电'],
            ['source_text' => '화장품/미용', 'target_lang' => 'en', 'translated_text' => 'Cosmetics/Beauty'],
        ];

        foreach ($entries as $entry) {
            TranslationCache::firstOrCreate(
                [
                    'source_text' => $entry['source_text'],
                    'target_lang' => $entry['target_lang'],
                ],
                ['translated_text' => $entry['translated_text']],
            );
        }
    }
}
