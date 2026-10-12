<?php

namespace App\Http\Resources;

use App\Models\ProductReport;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductReportResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reason' => $this->reason,
            'reason_label' => ProductReport::REASONS[$this->reason] ?? $this->reason,
            'details' => $this->details,
            'status' => $this->status,
            'admin_note' => $this->admin_note,
            'product' => $this->whenLoaded('product', fn () => $this->product ? new ProductResource($this->product) : null),
            'reporter' => $this->whenLoaded('reporter', fn () => $this->reporter?->only(['id', 'name', 'email'])),
            'resolver' => $this->whenLoaded('resolver', fn () => $this->resolver?->only(['id', 'name'])),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
