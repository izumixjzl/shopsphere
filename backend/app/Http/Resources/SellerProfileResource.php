<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SellerProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'store_name' => $this->store_name,
            'store_slug' => $this->store_slug,
            'description' => $this->description,
            'logo_url' => $this->logo_url,
            'banner_url' => $this->banner_url,
            'contact_email' => $this->contact_email,
            'contact_phone' => $this->contact_phone,
            'business_address' => $this->business_address,
            'status' => $this->status->value,
            'commission_rate' => $this->commission_rate,
            'effective_commission_rate' => $this->effectiveCommissionRate(),
            'rating_avg' => (float) $this->rating_avg,
            'rating_count' => (int) $this->rating_count,
            'approved_at' => $this->approved_at?->toIso8601String(),
            'suspended_at' => $this->suspended_at?->toIso8601String(),
            'rejection_reason' => $this->rejection_reason,
            'has_accepted_document' => $this->whenLoaded('verifications', fn () => $this->verifications->contains('status', 'approved')),
            'appeals' => SellerAppealResource::collection($this->whenLoaded('appeals')),
            'owner' => $this->whenLoaded('user', fn () => ['id' => $this->user->id, 'name' => $this->user->name, 'email' => $this->user->email]),
            'verifications' => $this->whenLoaded('verifications'),
            'products_count' => $this->whenHas('products_count'),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
