<?php

namespace App\Services;

class ProviderDetector
{
    /**
     * URL을 기반으로 프로바이더 타입을 감지한다.
     *
     * - 포트 11434 또는 /api/embed 패턴: 'ollama'
     * - 그 외: 'openai' (OpenAI 호환)
     */
    public function detect(string $url): string
    {
        if (str_contains($url, ':11434') || str_contains($url, '/api/embed')) {
            return 'ollama';
        }

        return 'openai';
    }
}
