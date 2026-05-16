<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CategoryPipelineCompleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $categoryId,
        public bool $allSuccess,
        public int $failedStep,
    ) {}

    public function broadcastOn(): Channel
    {
        return new Channel("category.{$this->categoryId}");
    }

    public function broadcastAs(): string
    {
        return 'category.completed';
    }
}
