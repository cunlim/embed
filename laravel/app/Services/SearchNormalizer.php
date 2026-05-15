<?php

namespace App\Services;

class SearchNormalizer
{
    /**
     * 검색어를 정규화하여 캐시 히트율을 높인다.
     *
     * - 앞뒤 공백 제거
     * - 연속 공백 → 단일 공백
     * - 소문자화 (영어만, 한글/중국어는 변환하지 않음)
     */
    public function normalize(string $text): string
    {
        $text = trim($text);
        $text = preg_replace("/\s+/", " ", $text);
        $text = mb_strtolower($text, "UTF-8");

        return $text;
    }
}
