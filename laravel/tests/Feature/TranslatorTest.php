<?php

use App\Models\TranslationCache;
use App\Services\Contracts\TranslationProviderInterface;
use App\Services\Translator;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['services.translate.model' => 'translategemma:4b']);
});

test('캐시 히트 시 Provider를 호출하지 않고 캐시된 결과를 반환한다', function () {
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

test('캐시 미스 시 Provider로 번역 후 결과를 캐싱한다', function () {
    $mock = $this->mock(TranslationProviderInterface::class);
    $mock->shouldReceive('chat')
        ->once()
        ->with('translategemma:4b', Mockery::pattern('/Translate/'))
        ->andReturn('Test Translation');

    $translator = app(Translator::class);
    $result = $translator->translate('안녕하세요', 'en');

    expect($result)->toBe('Test Translation');

    $cached = TranslationCache::query()
        ->where('source_text', '안녕하세요')
        ->where('target_lang', 'en')
        ->first();

    expect($cached)->not->toBeNull();
    expect($cached->translated_text)->toBe('Test Translation');
});

test('> 구분자가 포함된 텍스트는 분할 번역 후 조립한다', function () {
    $mock = $this->mock(TranslationProviderInterface::class);
    $mock->shouldReceive('chat')
        ->times(3)
        ->andReturn('Fashion', "Women's Clothing", 'Dress');

    $translator = app(Translator::class);
    $result = $translator->translate('패션의류>여성의류>원피스', 'en');

    expect($result)->toBe("Fashion>Women's Clothing>Dress");
});

test('환각 발생 시 최대 3회 재시도 후 RuntimeException을 던진다', function () {
    $mock = $this->mock(TranslationProviderInterface::class);
    $mock->shouldReceive('chat')
        ->times(3)
        ->andReturn('한글이포함된결과');

    $translator = app(Translator::class);

    expect(fn () => $translator->translate('테스트', 'en'))
        ->toThrow(RuntimeException::class, 'en 번역 환각 3회');
});

test('빈 문자열 번역 결과는 재시도하여 유효한 결과를 반환한다', function () {
    $mock = $this->mock(TranslationProviderInterface::class);
    $mock->shouldReceive('chat')
        ->times(2)
        ->andReturn('', 'Valid Result');

    $translator = app(Translator::class);
    $result = $translator->translate('테스트', 'en');

    expect($result)->toBe('Valid Result');
});

test('지원하지 않는 언어 코드는 RuntimeException을 던진다', function () {
    $mock = $this->mock(TranslationProviderInterface::class);
    $mock->shouldNotReceive('chat');

    $translator = app(Translator::class);

    expect(fn () => $translator->translate('테스트', 'ja'))
        ->toThrow(RuntimeException::class, '지원하지 않는 번역 언어');
});

test('분할된 개별 세그먼트는 TranslationCache에 저장되어 후속 번역 시 재사용된다', function () {
    $mock = $this->mock(TranslationProviderInterface::class);
    $mock->shouldReceive('chat')
        ->times(3)
        ->andReturn('Fashion', "Women's Clothing", 'Dress');

    $translator = app(Translator::class);
    $result = $translator->translate('패션의류>여성의류>원피스', 'en');

    expect($result)->toBe("Fashion>Women's Clothing>Dress");

    // 개별 세그먼트가 각각 캐싱되었는지 확인
    expect(TranslationCache::query()
        ->where('source_text', '패션의류')
        ->where('target_lang', 'en')
        ->exists())->toBeTrue();
    expect(TranslationCache::query()
        ->where('source_text', '여성의류')
        ->where('target_lang', 'en')
        ->exists())->toBeTrue();
    expect(TranslationCache::query()
        ->where('source_text', '원피스')
        ->where('target_lang', 'en')
        ->exists())->toBeTrue();

    // 공통 세그먼트("패션의류", "여성의류")는 캐시 히트 → 신규 세그먼트만 Provider 호출
    $mock2 = $this->mock(TranslationProviderInterface::class);
    $mock2->shouldReceive('chat')
        ->once()
        ->with('translategemma:4b', Mockery::pattern('/블라우스/'))
        ->andReturn('Blouse');

    $translator2 = app(Translator::class);
    $result2 = $translator2->translate('패션의류>여성의류>블라우스', 'en');

    expect($result2)->toBe("Fashion>Women's Clothing>Blouse");
});

test('번역 결과의 앞뒤 공백은 trim 처리된다', function () {
    $mock = $this->mock(TranslationProviderInterface::class);
    $mock->shouldReceive('chat')
        ->once()
        ->andReturn('  Trimmed Result  ');

    $translator = app(Translator::class);
    $result = $translator->translate('공백테스트', 'en');

    expect($result)->toBe('Trimmed Result');
});
