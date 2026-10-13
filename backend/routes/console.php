<?php

use App\Models\Inventory;
use App\Services\NotificationService;
use App\Services\PaymentService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

// Cancel online orders that weren't paid in time and release their stock.
Artisan::command('payments:expire', function (PaymentService $payments) {
    $this->info($payments->expireUnpaidOrders().' unpaid order(s) expired.');
})->purpose('Cancel unpaid online orders past their payment deadline');

Schedule::command('payments:expire')->everyMinute()->withoutOverlapping();

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
