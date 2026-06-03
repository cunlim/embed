<?php

use App\Models\TranslationCache;
use App\Services\Contracts\TranslationProviderInterface;
use App\Services\Translator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class);
uses(RefreshDatabase::class);

beforeEach(function () {
    config(['services.translate.model' => 'translategemma:4b']);
});

test('캐시 히트 시 Provider를 호출하지 않는다', function () {
    TranslationCache::create([
        'source_text' => '테스트',
        'target_lang' => 'en',
        'translated_text' => 'Cached Result',
    ]);

    $mock = $this->mock(TranslationProviderInterface::class);
    $mock->shouldNotReceive('chat');

    $translator = app(Translator::class);
    $result = $translator->translate('테스트', 'en');

    expect($result)->toBe('Cached Result');
});

test('지원하지 않는 언어 코드는 RuntimeException을 던진다', function () {
    $mock = $this->mock(TranslationProviderInterface::class);
    $mock->shouldNotReceive('chat');

    $translator = app(Translator::class);

    expect(fn () => $translator->translate('테스트', 'ja'))
        ->toThrow(RuntimeException::class, '지원하지 않는 번역 언어');
});
