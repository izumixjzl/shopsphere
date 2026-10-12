<?php

use App\Models\Inventory;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Schedule;

// Daily digest: notify sellers about products at or below their low-stock threshold.
Schedule::call(function (NotificationService $notifications) {
    Inventory::query()
        ->with('product.seller')
        ->lowStock()
        ->get()
        ->groupBy(fn ($inv) => $inv->product->seller_id)
        ->each(function ($items, $sellerId) use ($notifications) {
            $notifications->send(
                $items->first()->product->seller,
                'inventory.low_stock_digest',
                'Low stock summary',
                $items->count().' product(s) are at or below their low-stock threshold.',
                ['product_ids' => $items->pluck('product_id')->all()],
            );
        });
})->dailyAt('08:00')->name('low-stock-digest');
