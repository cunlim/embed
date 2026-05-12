<?php

use App\Events\TranslationProgress;
use Illuminate\Broadcasting\Channel;

test('TranslationProgress broadcasts on translation.{batchId} channel', function () {
    $event = new TranslationProgress('abc-123', 10, 5, 1, 'processing');

    expect($event->broadcastOn())->toEqual(new Channel('translation.abc-123'));
});

test('TranslationProgress broadcasts as translation.progress', function () {
    $event = new TranslationProgress('abc-123', 10, 5, 1, 'processing');

    expect($event->broadcastAs())->toBe('translation.progress');
});

test('TranslationProgress sets all progress properties', function () {
    $event = new TranslationProgress('batch-99', 20, 15, 2, 'processing');

    expect($event->batchId)->toBe('batch-99');
    expect($event->totalJobs)->toBe(20);
    expect($event->completedJobs)->toBe(15);
    expect($event->failedJobs)->toBe(2);
    expect($event->status)->toBe('processing');
});
