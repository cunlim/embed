<?php

use App\Events\BatchFailed;
use Illuminate\Broadcasting\Channel;

test('BatchFailed broadcasts on translation.{batchId} channel', function () {
    $event = new BatchFailed('abc-123', 'error message');

    expect($event->broadcastOn())->toEqual(new Channel('translation.abc-123'));
});

test('BatchFailed broadcasts as batch.failed', function () {
    $event = new BatchFailed('abc-123', 'error message');

    expect($event->broadcastAs())->toBe('batch.failed');
});

test('BatchFailed sets batchId and errorMessage properties', function () {
    $event = new BatchFailed('abc-123', 'something went wrong');

    expect($event->batchId)->toBe('abc-123');
    expect($event->errorMessage)->toBe('something went wrong');
});
