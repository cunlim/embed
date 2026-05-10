<?php

use App\Services\TextSplitter;

test('split은 > 구분자로 텍스트를 분할한다', function () {
    $splitter = new TextSplitter;
    expect($splitter->split('패션의류>여성의류>원피스'))->toBe(['패션의류', '여성의류', '원피스']);
});

test('split은 > 구분자가 없는 텍스트를 단일 요소 배열로 반환한다', function () {
    $splitter = new TextSplitter;
    expect($splitter->split('단일텍스트'))->toBe(['단일텍스트']);
});

test('join은 문자열 배열을 > 구분자로 연결한다', function () {
    $splitter = new TextSplitter;
    expect($splitter->join(['A', 'B', 'C']))->toBe('A>B>C');
});

test('join은 단일 요소 배열을 구분자 없이 반환한다', function () {
    $splitter = new TextSplitter;
    expect($splitter->join(['Only']))->toBe('Only');
});

test('shouldSplit은 > 포함 시 true를 반환한다', function () {
    $splitter = new TextSplitter;
    expect($splitter->shouldSplit('대>중>소'))->toBeTrue();
});

test('shouldSplit은 > 미포함 시 false를 반환한다', function () {
    $splitter = new TextSplitter;
    expect($splitter->shouldSplit('단일텍스트'))->toBeFalse();
});
