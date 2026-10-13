<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SellerAppealResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'suspension_reason' => $this->suspension_reason,
            'message' => $this->message,
            'status' => $this->status,
            'admin_note' => $this->admin_note,
            'decider' => $this->whenLoaded('decider', fn () => $this->decider?->only(['id', 'name'])),
            'decided_at' => $this->decided_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
