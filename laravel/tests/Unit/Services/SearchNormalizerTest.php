<?php

use App\Services\SearchNormalizer;

test('앞뒤 공백을 제거한다', function () {
    $normalizer = new SearchNormalizer;

    expect($normalizer->normalize('  청바지  '))->toBe('청바지');
});

test('연속 공백을 단일 공백으로 변환한다', function () {
    $normalizer = new SearchNormalizer;

    expect($normalizer->normalize('나이키   에어   맥스'))->toBe('나이키 에어 맥스');
});

test('영어를 소문자화한다', function () {
    $normalizer = new SearchNormalizer;

    expect($normalizer->normalize('NIKE Shoes'))->toBe('nike shoes');
});

test('한글은 소문자화하지 않는다', function () {
    $normalizer = new SearchNormalizer;

    expect($normalizer->normalize('청바지 청바지'))->toBe('청바지 청바지');
});

test('혼합 언어 — 영어 소문자화 + 한글 유지 + 공백 정규화', function () {
    $normalizer = new SearchNormalizer;

    expect($normalizer->normalize('  NIKE   청바지  BIG  '))->toBe('nike 청바지 big');
});

test('빈 문자열은 빈 문자열을 반환한다', function () {
    $normalizer = new SearchNormalizer;

    expect($normalizer->normalize(''))->toBe('');
});

test('공백만 있는 문자열은 빈 문자열을 반환한다', function () {
    $normalizer = new SearchNormalizer;

    expect($normalizer->normalize('   '))->toBe('');
});

test('중국어는 소문자화하지 않는다', function () {
    $normalizer = new SearchNormalizer;

    expect($normalizer->normalize('运动鞋 NIKE'))->toBe('运动鞋 nike');
});
