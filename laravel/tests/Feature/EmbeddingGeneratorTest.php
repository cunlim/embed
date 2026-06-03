<?php

use App\Services\Contracts\EmbeddingProviderInterface;
use App\Services\EmbeddingGenerator;

test('generate는 config의 model로 EmbeddingProviderInterface embed를 호출한다', function () {
    config(['services.embed.model' => 'bge-m3:latest']);

    $mock = $this->mock(EmbeddingProviderInterface::class);
    $mock->shouldReceive('embed')
        ->once()
        ->with('bge-m3:latest', '테스트 텍스트')
        ->andReturn([0.1, 0.2, 0.3]);

    $generator = app(EmbeddingGenerator::class);
    $result = $generator->generate('테스트 텍스트');

    expect($result)->toBe([0.1, 0.2, 0.3]);
});

test('generate는 커스텀 config 값을 사용한다', function () {
    config(['services.embed.model' => 'custom-model:v2']);

    $mock = $this->mock(EmbeddingProviderInterface::class);
    $mock->shouldReceive('embed')
        ->once()
        ->with('custom-model:v2', Mockery::any())
        ->andReturn([0.5, 0.6]);

    $generator = app(EmbeddingGenerator::class);
    $result = $generator->generate('any');

    expect($result)->toBe([0.5, 0.6]);
});

test('generate는 1024차원 벡터를 반환할 수 있다', function () {
    $vector = array_fill(0, 1024, 0.0);

    $mock = $this->mock(EmbeddingProviderInterface::class);
    $mock->shouldReceive('embed')
        ->once()
        ->andReturn($vector);

    $generator = app(EmbeddingGenerator::class);
    $result = $generator->generate('텍스트');

    expect($result)->toHaveCount(1024);
});
