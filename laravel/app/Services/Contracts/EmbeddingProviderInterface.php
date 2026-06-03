<?php

namespace App\Services\Contracts;

interface EmbeddingProviderInterface
{
    /**
     * 텍스트를 벡터로 변환한다.
     *
     * @param string $model 모델명
     * @param string $text 임베딩할 텍스트
     * @return float[] 임베딩 벡터
     */
    public function embed(string $model, string $text): array;
}
