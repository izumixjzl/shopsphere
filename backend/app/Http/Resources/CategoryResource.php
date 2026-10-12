<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'parent_id' => $this->parent_id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'image_url' => $this->image_url,
            'is_active' => $this->is_active,
            'sort_order' => $this->sort_order,
            'products_count' => $this->whenHas('products_count'),
            'children' => self::collection($this->whenLoaded('children')),
        ];
    }
}
