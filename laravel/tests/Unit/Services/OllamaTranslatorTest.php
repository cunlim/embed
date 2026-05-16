<?php

use App\Models\TranslationCache;
use App\Services\OllamaClient;
use App\Services\OllamaTranslator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class);
uses(RefreshDatabase::class);

beforeEach(function () {
    config(['services.ollama.translation_model' => 'translategemma:4b']);
});

test('캐시 히트 시 OllamaClient를 호출하지 않는다', function () {
    TranslationCache::create([
        'source_text' => '테스트',
        'target_lang' => 'en',
        'translated_text' => 'Cached Result',
    ]);

    $mock = $this->mock(OllamaClient::class);
    $mock->shouldNotReceive('chat');

    $translator = app(OllamaTranslator::class);
    $result = $translator->translate('테스트', 'en');

    expect($result)->toBe('Cached Result');
});

test('지원하지 않는 언어 코드는 RuntimeException을 던진다', function () {
    $mock = $this->mock(OllamaClient::class);
    $mock->shouldNotReceive('chat');

    $translator = app(OllamaTranslator::class);

    expect(fn () => $translator->translate('테스트', 'ja'))
        ->toThrow(RuntimeException::class, '지원하지 않는 번역 언어');
});
