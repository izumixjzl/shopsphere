<?php

namespace App\Policies;

use App\Models\Product;
use App\Models\User;

class ProductPolicy
{
    /** Only the owning, approved seller may manage a product. */
    public function update(User $user, Product $product): bool
    {
        return $user->isApprovedSeller() && $product->seller_id === $user->id;
    }

    public function delete(User $user, Product $product): bool
    {
        return $this->update($user, $product);
    }

    public function moderate(User $user, Product $product): bool
    {
        return $user->isAdmin();
    }
}
