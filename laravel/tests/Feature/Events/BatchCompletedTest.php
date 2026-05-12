<?php

use App\Events\BatchCompleted;
use Illuminate\Broadcasting\Channel;

test('BatchCompleted broadcasts on translation.{batchId} channel', function () {
    $event = new BatchCompleted('abc-123');

    expect($event->broadcastOn())->toEqual(new Channel('translation.abc-123'));
});

test('BatchCompleted broadcasts as batch.completed', function () {
    $event = new BatchCompleted('abc-123');

    expect($event->broadcastAs())->toBe('batch.completed');
});

test('BatchCompleted sets batchId property', function () {
    $event = new BatchCompleted('abc-123');

    expect($event->batchId)->toBe('abc-123');
});

test('BatchCompleted defaults failedJobs to 0', function () {
    $event = new BatchCompleted('abc-123');

    expect($event->failedJobs)->toBe(0);
});

test('BatchCompleted accepts failedJobs parameter', function () {
    $event = new BatchCompleted('abc-123', 3);

    expect($event->failedJobs)->toBe(3);
});
