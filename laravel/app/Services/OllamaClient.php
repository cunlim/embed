<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class OllamaClient
{
    public function __construct(
        public string $baseUrl,
        public int $timeout = 300
    ) {}

    /**
     * Ollama /api/chat 엔드포인트를 호출하여 응답 content를 반환한다.
     */
    public function chat(string $model, string $prompt, array $options = []): string
    {
        $payload = [
            'model' => $model,
            'messages' => [
                ['role' => 'user', 'content' => $prompt],
            ],
            'stream' => false,
        ];

        if (! empty($options)) {
            $payload['options'] = $options;
        }

        $response = Http::timeout($this->timeout)
            ->post("{$this->baseUrl}/api/chat", $payload);

        if ($response->failed()) {
            $response->throw();
        }

        $content = $response->json('message.content');

        if ($content === null) {
            throw new \RuntimeException('Ollama chat 응답에서 message.content를 찾을 수 없습니다.');
        }

        return $content;
    }

    /**
     * Ollama /api/embed 엔드포인트를 호출하여 임베딩 벡터를 반환한다.
     *
     * @return float[]
     */
    public function embed(string $model, string $text): array
    {
        $response = Http::timeout($this->timeout)
            ->post("{$this->baseUrl}/api/embed", [
                'model' => $model,
                'input' => $text,
            ]);

        if ($response->failed()) {
            $response->throw();
        }

        $embedding = $response->json('embeddings.0');

        if ($embedding === null) {
            throw new \RuntimeException('Ollama embed 응답에서 embeddings를 찾을 수 없습니다.');
        }

        return $embedding;
    }
}
