<?php

namespace App\Services;

use App\Exceptions\InsufficientStockException;
use App\Models\Inventory;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

/**
 * All stock changes go through here. Callers that change stock must already be
 * inside a DB transaction; rows are locked with SELECT ... FOR UPDATE so two
 * concurrent checkouts can never both take the last unit.
 */
class InventoryService
{
    public function __construct(private NotificationService $notifications) {}

    /**
     * Lock inventory rows for the given product ids, ordered by product id so
     * concurrent transactions always lock in the same order (avoids deadlocks).
     *
     * @return \Illuminate\Support\Collection<int, Inventory> keyed by product_id
     */
    public function lockForProducts(array $productIds)
    {
        $this->assertInTransaction();

        $ids = collect($productIds)->unique()->sort()->values()->all();

        return Inventory::query()
            ->whereIn('product_id', $ids)
            ->orderBy('product_id')
            ->lockForUpdate()
            ->get()
            ->keyBy('product_id');
    }

    /** Decrement a locked row; throws if not enough stock. */
    public function deduct(Inventory $inventory, int $qty, string $productName): void
    {
        if ($qty < 1) {
            throw new \InvalidArgumentException('Quantity must be positive.');
        }
        if ($inventory->quantity < $qty) {
            throw new InsufficientStockException($productName, $inventory->quantity, $qty);
        }

        $inventory->quantity -= $qty;
        $inventory->save();

        $this->maybeAlertLowStock($inventory);
    }

    /** Put stock back (cancellation / return). Locks the row itself. */
    public function restock(int $productId, int $qty): void
    {
        $this->assertInTransaction();

        $inventory = Inventory::query()->where('product_id', $productId)->lockForUpdate()->first();
        if (! $inventory) {
            return; // product was hard-deleted; nothing to restock
        }

        $inventory->quantity += $qty;
        if (! $inventory->isLowStock()) {
            $inventory->low_stock_notified_at = null; // re-arm the alert
        }
        $inventory->save();
    }

    /** Seller sets an absolute stock level. */
    public function setQuantity(Product $product, int $quantity, ?int $threshold = null): Inventory
    {
        return DB::transaction(function () use ($product, $quantity, $threshold) {
            $inventory = Inventory::query()->where('product_id', $product->id)->lockForUpdate()->first()
                ?? new Inventory(['product_id' => $product->id]);

            $inventory->product_id = $product->id;
            $inventory->quantity = $quantity;
            if ($threshold !== null) {
                $inventory->low_stock_threshold = $threshold;
            }
            if (! $inventory->isLowStock()) {
                $inventory->low_stock_notified_at = null;
            }
            $inventory->save();

            $this->maybeAlertLowStock($inventory);

            return $inventory;
        });
    }

    private function maybeAlertLowStock(Inventory $inventory): void
    {
        if (! $inventory->isLowStock() || $inventory->low_stock_notified_at) {
            return;
        }

        $product = $inventory->product()->first();
        if (! $product) {
            return;
        }

        $this->notifications->send(
            $product->seller_id,
            $inventory->quantity === 0 ? 'inventory.out_of_stock' : 'inventory.low_stock',
            $inventory->quantity === 0 ? 'Out of stock' : 'Low stock alert',
            "{$product->name} ({$product->sku}) has {$inventory->quantity} unit(s) left.",
            ['product_id' => $product->id, 'quantity' => $inventory->quantity],
        );

        $inventory->forceFill(['low_stock_notified_at' => now()])->save();
    }

    private function assertInTransaction(): void
    {
        if (DB::transactionLevel() < 1) {
            throw new \LogicException('Stock changes must run inside a database transaction.');
        }
    }
}
