<?php

use App\Services\OllamaClient;
use App\Services\OllamaRateLimiter;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
});

function makeClient(string $baseUrl = 'http://ollama:11434', int $timeout = 300): OllamaClient
{
    return new OllamaClient(
        rateLimiter: new OllamaRateLimiter(1000, 1),
        baseUrl: $baseUrl,
        timeout: $timeout,
    );
}

test('chat은 Ollama API를 호출하고 응답 content를 반환한다', function () {
    Http::fake([
        'http://ollama:11434/api/chat' => Http::response([
            'message' => [
                'content' => '번역 결과입니다.',
            ],
        ], 200),
    ]);

    $result = makeClient()->chat('translategemma:4b', '안녕하세요');

    expect($result)->toBe('번역 결과입니다.');

    Http::assertSent(function ($request) {
        $body = $request->data();

        return $request->url() === 'http://ollama:11434/api/chat'
            && $body['model'] === 'translategemma:4b'
            && $body['stream'] === false;
    });
});

test('chat은 options를 요청에 포함한다', function () {
    Http::fake([
        'http://ollama:11434/api/chat' => Http::response([
            'message' => ['content' => 'ok'],
        ], 200),
    ]);

    makeClient()->chat('test-model', 'prompt', ['temperature' => 0.5]);

    Http::assertSent(function ($request) {
        $body = $request->data();

        return $body['options']['temperature'] === 0.5;
    });
});

test('embed은 Ollama API를 호출하고 벡터 배열을 반환한다', function () {
    Http::fake([
        'http://ollama:11434/api/embed' => Http::response([
            'embeddings' => [[0.1, 0.2, 0.3]],
        ], 200),
    ]);

    $result = makeClient()->embed('bge-m3:latest', '테스트 텍스트');

    expect($result)->toBe([0.1, 0.2, 0.3]);

    Http::assertSent(function ($request) {
        $body = $request->data();

        return $request->url() === 'http://ollama:11434/api/embed'
            && $body['model'] === 'bge-m3:latest'
            && $body['input'] === '테스트 텍스트';
    });
});

test('chat은 HTTP 오류 시 예외를 던진다', function () {
    Http::fake([
        'http://ollama:11434/api/chat' => Http::response('', 500),
    ]);

    makeClient()->chat('test', 'prompt');
})->throws(RequestException::class);

test('embed은 HTTP 오류 시 예외를 던진다', function () {
    Http::fake([
        'http://ollama:11434/api/embed' => Http::response('', 500),
    ]);

    makeClient()->embed('test', 'text');
})->throws(RequestException::class);

test('chat은 잘못된 응답 형식 시 RuntimeException을 던진다', function () {
    Http::fake([
        'http://ollama:11434/api/chat' => Http::response(['unexpected' => 'format'], 200),
    ]);

    makeClient()->chat('test', 'prompt');
})->throws(RuntimeException::class);
