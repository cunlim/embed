<?php

namespace App\Services;

class TextSplitter
{
    /**
     * ">" 구분자로 텍스트를 분할하여 배열로 반환한다.
     *
     * @return string[]
     */
    public function split(string $text): array
    {
        return array_map('trim', explode('>', $text));
    }

    /**
     * 문자열 배열을 ">" 구분자로 연결한다.
     */
    public function join(array $segments): string
    {
        return implode('>', $segments);
    }

    /**
     * 텍스트에 ">" 구분자가 포함되어 있으면 true를 반환한다.
     */
    public function shouldSplit(string $text): bool
    {
        return str_contains($text, '>');
    }
}
