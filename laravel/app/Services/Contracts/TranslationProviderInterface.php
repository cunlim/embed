<?php

namespace App\Services\Contracts;

interface TranslationProviderInterface
{
    /**
     * 채팅 API를 호출하여 응답 content를 반환한다.
     *
     * @param  string  $model  모델명
     * @param  string  $prompt  프롬프트
     * @param  array  $options  추가 옵션
     * @return string 응답 텍스트
     */
    public function chat(string $model, string $prompt, array $options = []): string;
}
