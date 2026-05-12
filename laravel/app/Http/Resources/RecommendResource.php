<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RecommendResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'category_code' => $this->category_code,
            'category_name' => $this->category_name,
            'similarity_score' => round($this->similarity_score, 4),
        ];
    }
}
