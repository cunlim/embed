<?php

namespace App\Services;

use App\Services\Contracts\EmbeddingProviderInterface;

class EmbeddingGenerator
{
    public function __construct(
        private EmbeddingProviderInterface $provider,
    ) {}

    /**
     * 텍스트를 1024차원 벡터로 변환한다.
     *
     * @return float[]
     */
    public function generate(string $text): array
    {
        $model = config('services.embed.model', 'bge-m3:latest');

        return $this->provider->embed($model, $text);
    }
}
