<?php

namespace App\Services;

class EmbeddingGenerator
{
    public function __construct(private OllamaClient $ollama) {}

    /**
     * 텍스트를 1024차원 벡터로 변환한다.
     *
     * @return float[]
     */
    public function generate(string $text): array
    {
        $model = config('services.ollama.embedding_model', 'bge-m3:latest');

        return $this->ollama->embed($model, $text);
    }
}
