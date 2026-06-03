<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // ollama 설정을 embed + translate로 마이그레이션
        $mappings = [
            // [oldKey, newGroup, newKey]
            ['host', 'embed', 'host'],
            ['host', 'translate', 'host'],
            ['embedding_model', 'embed', 'model'],
            ['translation_model', 'translate', 'model'],
            ['timeout', 'embed', 'timeout'],
            ['timeout', 'translate', 'timeout'],
            ['translation_max_attempts', 'translate', 'max_attempts'],
            ['rate_limit_max_attempts', 'embed', 'rate_limit_max_attempts'],
            ['rate_limit_decay_seconds', 'embed', 'rate_limit_decay_seconds'],
        ];

        foreach ($mappings as [$oldKey, $newGroup, $newKey]) {
            $old = DB::table('settings')
                ->where('group', 'ollama')
                ->where('key', $oldKey)
                ->first();

            if ($old) {
                DB::table('settings')->updateOrInsert(
                    ['group' => $newGroup, 'key' => $newKey],
                    [
                        'value' => $old->value,
                        'type' => $old->type,
                        'description' => $this->getDescription($newGroup, $newKey),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );
            }
        }

        // embed.api_key, translate.api_key 신규 추가
        foreach (['embed', 'translate'] as $group) {
            DB::table('settings')->updateOrInsert(
                ['group' => $group, 'key' => 'api_key'],
                [
                    'value' => '',
                    'type' => 'string',
                    'description' => $group === 'embed' ? '임베딩 API 키' : '번역 API 키',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }

        // ollama 그룹 삭제
        DB::table('settings')->where('group', 'ollama')->delete();
    }

    public function down(): void
    {
        // embed + translate → ollama 롤백
        $ollamaSettings = [
            ['host', 'http://host.docker.internal:11434', 'string', 'Ollama API 서버 주소'],
            ['embedding_model', 'bge-m3:latest', 'string', '임베딩 모델명'],
            ['translation_model', 'translategemma:4b', 'string', '번역 모델명'],
            ['timeout', '300', 'integer', 'HTTP 타임아웃(초)'],
            ['translation_max_attempts', '3', 'integer', '번역 환각 재시도 횟수'],
            ['rate_limit_max_attempts', '60', 'integer', 'Rate Limit 최대 시도'],
            ['rate_limit_decay_seconds', '60', 'integer', 'Rate Limit 시간 창(초)'],
        ];

        foreach ($ollamaSettings as [$key, $value, $type, $description]) {
            DB::table('settings')->updateOrInsert(
                ['group' => 'ollama', 'key' => $key],
                [
                    'value' => $value,
                    'type' => $type,
                    'description' => $description,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }

        DB::table('settings')->whereIn('group', ['embed', 'translate'])->delete();
    }

    private function getDescription(string $group, string $key): string
    {
        $descriptions = [
            'embed' => [
                'host' => '임베딩 API 서버 주소',
                'model' => '임베딩 모델명',
                'timeout' => '임베딩 API HTTP 타임아웃(초)',
                'rate_limit_max_attempts' => '임베딩 Rate Limit 최대 시도',
                'rate_limit_decay_seconds' => '임베딩 Rate Limit 시간 창(초)',
            ],
            'translate' => [
                'host' => '번역 API 서버 주소',
                'model' => '번역 모델명',
                'timeout' => '번역 API HTTP 타임아웃(초)',
                'max_attempts' => '번역 환각 재시도 횟수',
            ],
        ];

        return $descriptions[$group][$key] ?? '';
    }
};
