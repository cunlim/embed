<?php

use App\Events\CategoryPipelineCompleted;
use Illuminate\Broadcasting\Channel;

test('CategoryPipelineCompleted broadcasts on category.{categoryId} channel', function () {
    $event = new CategoryPipelineCompleted(1, true, 0);

    expect($event->broadcastOn())->toEqual(new Channel('category.1'));
});

test('CategoryPipelineCompleted broadcasts as category.completed', function () {
    $event = new CategoryPipelineCompleted(1, true, 0);

    expect($event->broadcastAs())->toBe('category.completed');
});

test('CategoryPipelineCompleted sets all properties when all success', function () {
    $event = new CategoryPipelineCompleted(42, true, 0);

    expect($event->categoryId)->toBe(42);
    expect($event->allSuccess)->toBeTrue();
    expect($event->failedStep)->toBe(0);
});

test('CategoryPipelineCompleted sets all properties when failed', function () {
    $event = new CategoryPipelineCompleted(42, false, 3);

    expect($event->categoryId)->toBe(42);
    expect($event->allSuccess)->toBeFalse();
    expect($event->failedStep)->toBe(3);
});
