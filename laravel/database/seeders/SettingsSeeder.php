<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    public function run(): void
    {
        Setting::firstOrCreate(
            ['group' => 'ollama', 'key' => 'host'],
            [
                'value' => 'http://host.docker.internal:11434',
                'type' => 'string',
                'description' => 'Ollama API 서버 주소',
            ]
        );

        Setting::firstOrCreate(
            ['group' => 'ollama', 'key' => 'translation_model'],
            [
                'value' => 'translategemma:4b',
                'type' => 'string',
                'description' => '번역에 사용할 Ollama 모델명',
            ]
        );

        Setting::firstOrCreate(
            ['group' => 'ollama', 'key' => 'embedding_model'],
            [
                'value' => 'bge-m3:latest',
                'type' => 'string',
                'description' => '임베딩에 사용할 Ollama 모델명',
            ]
        );

        Setting::firstOrCreate(
            ['group' => 'ollama', 'key' => 'rate_limit_max_attempts'],
            [
                'value' => '60',
                'type' => 'integer',
                'description' => 'Rate Limit: 시간 창 내 최대 Ollama API 호출 횟수',
            ]
        );

        Setting::firstOrCreate(
            ['group' => 'ollama', 'key' => 'rate_limit_decay_seconds'],
            [
                'value' => '60',
                'type' => 'integer',
                'description' => 'Rate Limit: 시간 창(초). 이 시간 동안 max_attempts만큼 허용',
            ]
        );
    }
}
