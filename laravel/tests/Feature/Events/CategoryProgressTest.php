<?php

use App\Events\CategoryProgress;
use Illuminate\Broadcasting\Channel;

test('CategoryProgress broadcasts on category.{categoryId} channel', function () {
    $event = new CategoryProgress(1, 2, 'translation.en', 'running');

    expect($event->broadcastOn())->toEqual(new Channel('category.1'));
});

test('CategoryProgress broadcasts as category.progress', function () {
    $event = new CategoryProgress(1, 1, 'translation.zh', 'running');

    expect($event->broadcastAs())->toBe('category.progress');
});

test('CategoryProgress sets all public properties', function () {
    $event = new CategoryProgress(42, 3, 'embedding.ko', 'completed');

    expect($event->categoryId)->toBe(42);
    expect($event->step)->toBe(3);
    expect($event->stepName)->toBe('embedding.ko');
    expect($event->status)->toBe('completed');
    expect($event->error)->toBeNull();
});

test('CategoryProgress error property defaults to null', function () {
    $event = new CategoryProgress(1, 1, 'translation.zh', 'running');

    expect($event->error)->toBeNull();
});

test('CategoryProgress error property can be set', function () {
    $event = new CategoryProgress(1, 2, 'translation.en', 'failed', 'Ollama timeout');

    expect($event->error)->toBe('Ollama timeout');
});
