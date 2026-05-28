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

        // ollama 추가
        Setting::firstOrCreate(
            ['group' => 'ollama', 'key' => 'timeout'],
            [
                'value' => '300',
                'type' => 'integer',
                'description' => 'Ollama API HTTP 요청 타임아웃(초)',
            ]
        );

        Setting::firstOrCreate(
            ['group' => 'ollama', 'key' => 'translation_max_attempts'],
            [
                'value' => '3',
                'type' => 'integer',
                'description' => '번역 환각 시 최대 재시도 횟수',
            ]
        );

        // pagination
        Setting::firstOrCreate(
            ['group' => 'pagination', 'key' => 'default_per_page'],
            [
                'value' => '20',
                'type' => 'integer',
                'description' => '기본 페이지당 항목 수',
            ]
        );

        Setting::firstOrCreate(
            ['group' => 'pagination', 'key' => 'max_per_page_guest'],
            [
                'value' => '100',
                'type' => 'integer',
                'description' => '비로그인 사용자 최대 페이지당 항목 수',
            ]
        );

        // recommend
        Setting::firstOrCreate(
            ['group' => 'recommend', 'key' => 'default_limit'],
            [
                'value' => '5',
                'type' => 'integer',
                'description' => '추천 API 기본 결과 수',
            ]
        );

        Setting::firstOrCreate(
            ['group' => 'recommend', 'key' => 'max_per_page'],
            [
                'value' => '100',
                'type' => 'integer',
                'description' => '추천 API 최대 페이지당 항목 수',
            ]
        );

        // auth
        Setting::firstOrCreate(
            ['group' => 'auth', 'key' => 'token_expiry_days'],
            [
                'value' => '30',
                'type' => 'integer',
                'description' => 'Sanctum 토큰 쿠키 만료일',
            ]
        );

        Setting::firstOrCreate(
            ['group' => 'auth', 'key' => 'session_lifetime'],
            [
                'value' => '120',
                'type' => 'integer',
                'description' => '세션 수명(분)',
            ]
        );

        // category
        Setting::firstOrCreate(
            ['group' => 'category', 'key' => 'code_prefix'],
            [
                'value' => 'CAT_',
                'type' => 'string',
                'description' => '카테고리 코드 prefix',
            ]
        );

        Setting::firstOrCreate(
            ['group' => 'category', 'key' => 'code_random_length'],
            [
                'value' => '8',
                'type' => 'integer',
                'description' => '카테고리 코드 랜덤 문자열 길이',
            ]
        );

        Setting::firstOrCreate(
            ['group' => 'category', 'key' => 'code_max_attempts'],
            [
                'value' => '3',
                'type' => 'integer',
                'description' => '카테고리 코드 생성 최대 시도 횟수',
            ]
        );

        Setting::firstOrCreate(
            ['group' => 'category', 'key' => 'max_depth'],
            [
                'value' => '10',
                'type' => 'integer',
                'description' => '필터로 노출할 최대 카테고리 깊이',
            ]
        );

        // validation
        Setting::firstOrCreate(
            ['group' => 'validation', 'key' => 'text_max_length'],
            [
                'value' => '500',
                'type' => 'integer',
                'description' => '추천 텍스트/키워드 최대 길이 (UI·문서 표시용)',
            ]
        );

        Setting::firstOrCreate(
            ['group' => 'validation', 'key' => 'name_max_length'],
            [
                'value' => '255',
                'type' => 'integer',
                'description' => '카테고리명·사용자명 최대 길이 (UI·문서 표시용)',
            ]
        );

        // cache
        Setting::firstOrCreate(
            ['group' => 'cache', 'key' => 'settings_ttl'],
            [
                'value' => '3600',
                'type' => 'integer',
                'description' => 'Settings 캐시 수명(초)',
            ]
        );

        // frontend
        Setting::firstOrCreate(
            ['group' => 'frontend', 'key' => 'step_delay_ms'],
            [
                'value' => '2000',
                'type' => 'integer',
                'description' => '번역·임베딩 단계 실행 간 지연(ms)',
            ]
        );
    }
}
