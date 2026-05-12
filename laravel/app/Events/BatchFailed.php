<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class BatchFailed implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $batchId,
        public string $errorMessage,
    ) {}

    public function broadcastOn(): Channel
    {
        return new Channel("translation.{$this->batchId}");
    }

    public function broadcastAs(): string
    {
        return 'batch.failed';
    }
}
