<?php

namespace App\Policies;

use App\Models\SellerOrder;
use App\Models\User;

class SellerOrderPolicy
{
    public function view(User $user, SellerOrder $sellerOrder): bool
    {
        return $user->isAdmin() || $sellerOrder->seller_id === $user->id;
    }

    public function update(User $user, SellerOrder $sellerOrder): bool
    {
        return $user->isAdmin() || ($user->isApprovedSeller() && $sellerOrder->seller_id === $user->id);
    }
}
