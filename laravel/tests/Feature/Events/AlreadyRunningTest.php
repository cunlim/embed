<?php

use App\Events\AlreadyRunning;
use Illuminate\Broadcasting\Channel;

test('AlreadyRunning broadcasts on translation channel', function () {
    $event = new AlreadyRunning('en');

    expect($event->broadcastOn())->toEqual(new Channel('translation'));
});

test('AlreadyRunning broadcasts as translation.already-running', function () {
    $event = new AlreadyRunning('en');

    expect($event->broadcastAs())->toBe('translation.already-running');
});

test('AlreadyRunning sets language property', function () {
    $event = new AlreadyRunning('zh');

    expect($event->language)->toBe('zh');
});

test('AlreadyRunning defaults categoryIds to null', function () {
    $event = new AlreadyRunning('en');

    expect($event->categoryIds)->toBeNull();
});

test('AlreadyRunning accepts categoryIds parameter', function () {
    $event = new AlreadyRunning('en', [1, 2, 3]);

    expect($event->categoryIds)->toBe([1, 2, 3]);
});
