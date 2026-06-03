<?php

use App\Models\TranslationCache;
use App\Services\Contracts\TranslationProviderInterface;
use App\Services\Translator;

beforeEach(function () {
    config(['services.translate.model' => 'translategemma:4b']);
});

test('4계층 > 구분자 카테고리: 첫 번째 번역은 모든 세그먼트를 Provider로 번역 후 개별 캐싱한다', function () {
    $mock = $this->mock(TranslationProviderInterface::class);
    $mock->shouldReceive('chat')
        ->times(4)
        ->andReturn('Furniture/Interior', 'DIY Materials/Supplies', 'Furniture Parts', 'Furniture Legs');

    $translator = app(Translator::class);
    $result = $translator->translate('가구/인테리어>DIY자재/용품>가구부속품>가구다리', 'en');

    expect($result)->toBe('Furniture/Interior>DIY Materials/Supplies>Furniture Parts>Furniture Legs');

    // 4개 세그먼트가 각각 개별 캐싱되었는지 확인
    $segments = ['가구/인테리어', 'DIY자재/용품', '가구부속품', '가구다리'];
    foreach ($segments as $seg) {
        expect(TranslationCache::query()
            ->where('source_text', $seg)
            ->where('target_lang', 'en')
            ->exists())->toBeTrue("세그먼트 '{$seg}' 가 캐싱되어야 함");
    }

    // 전문(full text)도 캐싱되었는지 확인
    expect(TranslationCache::query()
        ->where('source_text', '가구/인테리어>DIY자재/용품>가구부속품>가구다리')
        ->where('target_lang', 'en')
        ->exists())->toBeTrue();
});

test('4계층 > 구분자 카테고리: 공통 prefix 세그먼트는 캐시 히트, 마지막 세그먼트만 Provider 호출', function () {
    // 선행 번역으로 공통 prefix 3개 세그먼트를 캐싱
    $mock1 = $this->mock(TranslationProviderInterface::class);
    $mock1->shouldReceive('chat')
        ->times(4)
        ->andReturn('Furniture/Interior', 'DIY Materials/Supplies', 'Furniture Parts', 'Furniture Legs');

    $translator1 = app(Translator::class);
    $translator1->translate('가구/인테리어>DIY자재/용품>가구부속품>가구다리', 'en');

    // 두 번째 번역: 공통 3개 세그먼트는 캐시 히트 → "가구바퀴"만 Provider 호출
    $mock2 = $this->mock(TranslationProviderInterface::class);
    $mock2->shouldReceive('chat')
        ->once()
        ->with('translategemma:4b', Mockery::pattern('/가구바퀴/'))
        ->andReturn('Furniture Wheels');

    $translator2 = app(Translator::class);
    $result = $translator2->translate('가구/인테리어>DIY자재/용품>가구부속품>가구바퀴', 'en');

    expect($result)->toBe('Furniture/Interior>DIY Materials/Supplies>Furniture Parts>Furniture Wheels');

    // 신규 세그먼트도 캐싱되었는지 확인
    expect(TranslationCache::query()
        ->where('source_text', '가구바퀴')
        ->where('target_lang', 'en')
        ->exists())->toBeTrue();
});

test('4계층 > 구분자 카테고리 4종 연속 번역: 총 Provider 호출 횟수 검증', function () {
    $categories = [
        '가구/인테리어>DIY자재/용품>가구부속품>가구다리',
        '가구/인테리어>DIY자재/용품>가구부속품>가구바퀴',
        '가구/인테리어>DIY자재/용품>가구부속품>경첩/꺽쇠/자석철물류',
        '가구/인테리어>DIY자재/용품>가구부속품>기타가구부속품',
    ];

    $expectedTranslations = [
        'Furniture/Interior',
        'DIY Materials/Supplies',
        'Furniture Parts',
        'Furniture Legs',        // 카테고리1 마지막
        'Furniture Wheels',      // 카테고리2 마지막
        'Hinges/Brackets',       // 카테고리3 마지막
        'Other Parts',           // 카테고리4 마지막
    ];

    // 총 7개 고유 세그먼트 → 7회 Provider 호출
    $mock = $this->mock(TranslationProviderInterface::class);
    $mock->shouldReceive('chat')
        ->times(7)
        ->andReturnValues($expectedTranslations);

    $translator = app(Translator::class);

    $result1 = $translator->translate($categories[0], 'en');
    expect($result1)->toBe('Furniture/Interior>DIY Materials/Supplies>Furniture Parts>Furniture Legs');

    $result2 = $translator->translate($categories[1], 'en');
    expect($result2)->toBe('Furniture/Interior>DIY Materials/Supplies>Furniture Parts>Furniture Wheels');

    $result3 = $translator->translate($categories[2], 'en');
    expect($result3)->toBe('Furniture/Interior>DIY Materials/Supplies>Furniture Parts>Hinges/Brackets');

    $result4 = $translator->translate($categories[3], 'en');
    expect($result4)->toBe('Furniture/Interior>DIY Materials/Supplies>Furniture Parts>Other Parts');

    // 총 7개 고유 세그먼트가 캐싱되었는지 확인
    $allUniqueSegments = [
        '가구/인테리어', 'DIY자재/용품', '가구부속품',
        '가구다리', '가구바퀴', '경첩/꺽쇠/자석철물류', '기타가구부속품',
    ];
    foreach ($allUniqueSegments as $seg) {
        expect(TranslationCache::query()
            ->where('source_text', $seg)
            ->where('target_lang', 'en')
            ->exists())->toBeTrue();
    }

    // 전문(full text)도 4개 모두 캐싱
    foreach ($categories as $cat) {
        expect(TranslationCache::query()
            ->where('source_text', $cat)
            ->where('target_lang', 'en')
            ->exists())->toBeTrue();
    }
});

test('zh 타겟 언어에서도 세그먼트 캐싱이 동일하게 동작한다', function () {
    // 첫 번째 카테고리: 4회 호출
    $mock1 = $this->mock(TranslationProviderInterface::class);
    $mock1->shouldReceive('chat')
        ->times(4)
        ->andReturn('家具/室内', 'DIY材料/用品', '家具配件', '家具腿');

    $translator1 = app(Translator::class);
    $translator1->translate('가구/인테리어>DIY자재/용품>가구부속품>가구다리', 'zh');

    // 두 번째 카테고리: 마지막 세그먼트만 1회 호출
    $mock2 = $this->mock(TranslationProviderInterface::class);
    $mock2->shouldReceive('chat')
        ->once()
        ->with('translategemma:4b', Mockery::pattern('/가구바퀴/'))
        ->andReturn('家具轮');

    $translator2 = app(Translator::class);
    $result = $translator2->translate('가구/인테리어>DIY자재/용품>가구부속품>가구바퀴', 'zh');

    expect($result)->toBe('家具/室内>DIY材料/用品>家具配件>家具轮');
});
