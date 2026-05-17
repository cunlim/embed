<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CategoryProgress implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $categoryId,
        public int $step,
        public string $stepName,
        public string $status,
        public ?string $error = null,
        public ?string $result = null,
    ) {}

    public function broadcastOn(): Channel
    {
        return new Channel("category.{$this->categoryId}");
    }

    public function broadcastAs(): string
    {
        return 'category.progress';
    }
}
