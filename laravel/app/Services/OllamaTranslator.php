<?php

namespace App\Services;

use App\Models\TranslationCache;
use RuntimeException;

class OllamaTranslator
{
    private const MAX_ATTEMPTS = 3;

    public function __construct(
        private OllamaClient $ollama,
    ) {}

    /**
     * 원문 텍스트를 대상 언어로 번역한다.
     *
     * @throws RuntimeException 3회 재시도 후에도 환각이 발생하는 경우
     */
    public function translate(string $sourceText, string $targetLang): string
    {
        $cached = TranslationCache::query()
            ->where('source_text', $sourceText)
            ->where('target_lang', $targetLang)
            ->first();

        if ($cached !== null) {
            return $cached->translated_text;
        }

        $textSplitter = new TextSplitter;

        if ($textSplitter->shouldSplit($sourceText)) {
            $segments = $textSplitter->split($sourceText);
            $translatedSegments = array_map(
                fn (string $seg): string => $this->translateSingle($seg, $targetLang),
                $segments
            );

            $result = $textSplitter->join($translatedSegments);
        } else {
            $result = $this->translateSingle($sourceText, $targetLang);
        }

        // firstOrCreate: PostgreSQL에서는 UniqueConstraintViolationException을
        // catch해도 트랜잭션이 aborted 상태가 되어 후속 쿼리가 실패한다.
        $cached = TranslationCache::firstOrCreate(
            ['source_text' => $sourceText, 'target_lang' => $targetLang],
            ['translated_text' => $result],
        );

        if ($cached->wasRecentlyCreated === false) {
            return $cached->translated_text;
        }

        return $result;
    }

    /**
     * 단일 텍스트 세그먼트를 번역한다. 환각 검증 및 재시도 포함.
     */
    private function translateSingle(string $text, string $targetLang): string
    {
        $cached = TranslationCache::query()
            ->where('source_text', $text)
            ->where('target_lang', $targetLang)
            ->first();

        if ($cached !== null) {
            return $cached->translated_text;
        }

        $model = config('services.ollama.translation_model', 'translategemma:4b');
        $attempts = 0;

        do {
            $result = $this->ollama->chat($model, $this->buildPrompt($text, $targetLang));
            $result = trim($result);

            if ($this->isValidTranslation($result, $targetLang)) {
                $cached = TranslationCache::firstOrCreate(
                    ['source_text' => $text, 'target_lang' => $targetLang],
                    ['translated_text' => $result],
                );

                return $cached->translated_text;
            }

            $attempts++;
        } while ($attempts < self::MAX_ATTEMPTS);

        throw new RuntimeException(
            "{$targetLang} 번역 환각 {$attempts}회 발생: 원문=\"{$text}\" 결과=\"{$result}\""
        );
    }

    /**
     * Ollama에 보낼 번역 프롬프트를 생성한다.
     */
    private function buildPrompt(string $sourceText, string $targetLang): string
    {
        $languageName = match ($targetLang) {
            'zh' => 'Chinese',
            'en' => 'English',
            default => throw new RuntimeException("지원하지 않는 번역 언어: {$targetLang}"),
        };

        return "Translate the following Korean text to {$languageName}. Return ONLY the translated text, nothing else.\n\nText: {$sourceText}";
    }

    /**
     * 번역 결과가 타겟 언어에 맞는 문자로만 구성되어 있는지 검증한다.
     * ADR-003: 2자 이상 연속된 금지 문자가 있으면 환각으로 판단.
     */
    private function isValidTranslation(string $text, string $targetLang): bool
    {
        if ($text === '') {
            return false;
        }

        return match ($targetLang) {
            'zh' => ! $this->hasConsecutiveHangul($text),
            'en' => ! $this->hasConsecutiveHangul($text) && ! $this->hasConsecutiveHan($text),
            default => true,
        };
    }

    /**
     * 한글(U+AC00~U+D7AF)이 2자 이상 연속으로 포함되어 있는지 검사.
     */
    private function hasConsecutiveHangul(string $text): bool
    {
        return preg_match("/\p{Hangul}{2,}/u", $text) === 1;
    }

    /**
     * 한자(U+4E00~U+9FFF)가 2자 이상 연속으로 포함되어 있는지 검사.
     */
    private function hasConsecutiveHan(string $text): bool
    {
        return preg_match("/\p{Han}{2,}/u", $text) === 1;
    }
}
