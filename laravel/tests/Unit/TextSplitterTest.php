<?php

use App\Services\TextSplitter;

test('split은 > 구분자로 텍스트를 분할한다', function () {
    $splitter = new TextSplitter;
    expect($splitter->split('패션의류>여성의류>원피스'))->toBe(['패션의류', '여성의류', '원피스']);
});
