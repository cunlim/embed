<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ApiSearchResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'category_code' => $this->category_code,
            'category_name' => $this->category_name,
            'similarity_score' => round((float) ($this->similarity_score ?? 0), 4),
        ];
    }
}
