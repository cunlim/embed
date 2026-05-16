<?php

use App\Models\TranslationCache;
use App\Services\OllamaClient;
use App\Services\OllamaTranslator;
use App\Services\TextSplitter;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

beforeEach(function () {
    config(['services.ollama.translation_model' => 'translategemma:4b']);

    Schema::create('translation_caches', function (Blueprint $table) {
        $table->id();
        $table->text('source_text');
        $table->string('target_lang', 10);
        $table->text('translated_text');
        $table->unique(['source_text', 'target_lang']);
        $table->timestamps();
    });
});

afterEach(function () {
    Schema::dropIfExists('translation_caches');
});

test('OllamaTranslator — 캐시 히트 시 OllamaClient를 호출하지 않는다', function () {
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

test('TextSplitter — > 구분자로 분할한다', function () {
    $splitter = new TextSplitter;
    expect($splitter->split('패션의류>여성의류>원피스'))->toBe(['패션의류', '여성의류', '원피스']);
});

test('TextSplitter — > 구분자로 재조립한다', function () {
    $splitter = new TextSplitter;
    expect($splitter->join(['Fashion', "Women's Clothing", 'Dress']))->toBe("Fashion>Women's Clothing>Dress");
});

test('TextSplitter — 단일 텍스트는 분할 없이 그대로 반환한다', function () {
    $splitter = new TextSplitter;
    expect($splitter->split('단일텍스트'))->toBe(['단일텍스트']);
});

test('TextSplitter — 단일 요소 배열은 구분자 없이 반환한다', function () {
    $splitter = new TextSplitter;
    expect($splitter->join(['Only']))->toBe('Only');
});

test('OllamaTranslator — 지원하지 않는 언어 코드는 RuntimeException을 던진다', function () {
    $mock = $this->mock(OllamaClient::class);
    $mock->shouldNotReceive('chat');

    $translator = app(OllamaTranslator::class);

    expect(fn () => $translator->translate('테스트', 'ja'))
        ->toThrow(RuntimeException::class, '지원하지 않는 번역 언어');
});
