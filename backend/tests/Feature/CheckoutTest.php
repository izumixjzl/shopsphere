<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\Cart;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CheckoutTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;
    private Address $address;
    private User $sellerA;
    private User $sellerB;

    protected function setUp(): void
    {
        parent::setUp();
        config(['marketplace.shipping_fee_per_seller' => 50, 'marketplace.default_commission_rate' => 10]);

        $this->customer = User::factory()->create();
        $this->address = Address::factory()->for($this->customer)->create();
        $this->sellerA = User::factory()->seller()->create();
        $this->sellerB = User::factory()->seller()->create();
    }

    private function addToCart(Product $p, int $qty): void
    {
        $this->actingAsRole($this->customer)
            ->postJson('/api/cart/items', ['product_id' => $p->id, 'quantity' => $qty])
            ->assertCreated();
    }

    private function checkout()
    {
        return $this->actingAsRole($this->customer)->postJson('/api/orders', [
            'address_id' => $this->address->id, 'payment_method' => 'cod',
        ]);
    }

    public function test_checkout_splits_order_per_seller_and_snapshots_items(): void
    {
        $p1 = Product::factory()->for($this->sellerA, 'seller')->withStock(10)->create(['price' => 100, 'name' => 'Alpha']);
        $p2 = Product::factory()->for($this->sellerA, 'seller')->withStock(10)->create(['price' => 200]);
        $p3 = Product::factory()->for($this->sellerB, 'seller')->withStock(10)->create(['price' => 300]);

        $this->addToCart($p1, 2);
        $this->addToCart($p2, 1);
        $this->addToCart($p3, 1);

        $res = $this->checkout()->assertCreated()
            ->assertJsonPath('subtotal', '700.00')
            ->assertJsonPath('shipping_total', '100.00')
            ->assertJsonPath('grand_total', '800.00')
            ->assertJsonCount(2, 'seller_orders');

        $orderId = $res->json('id');

        // Seller A: 400 subtotal, 10% = 40 commission, earnings 400 + 50 - 40 = 410.
        $this->assertDatabaseHas('seller_orders', [
            'order_id' => $orderId, 'seller_id' => $this->sellerA->id,
            'subtotal' => '400.00', 'commission_amount' => '40.00', 'seller_earnings' => '410.00',
        ]);
        $this->assertDatabaseHas('commission_records', ['seller_id' => $this->sellerB->id, 'commission_amount' => '30.00', 'status' => 'pending']);
        $this->assertDatabaseHas('payments', ['order_id' => $orderId, 'method' => 'cod', 'status' => 'pending', 'amount' => '800.00']);

        // Stock deducted, cart emptied.
        $this->assertSame(8, $p1->inventory()->value('quantity'));
        $this->assertSame(0, Cart::where('user_id', $this->customer->id)->first()->items()->count());

        // Snapshots survive later product edits.
        $p1->update(['name' => 'Renamed', 'price' => 999]);
        $this->assertDatabaseHas('order_items', ['product_id' => $p1->id, 'product_name' => 'Alpha', 'unit_price' => '100.00']);
    }

    public function test_cannot_add_more_than_available_stock(): void
    {
        $p = Product::factory()->for($this->sellerA, 'seller')->withStock(2)->create();

        $this->actingAsRole($this->customer)
            ->postJson('/api/cart/items', ['product_id' => $p->id, 'quantity' => 3])
            ->assertUnprocessable()->assertJsonValidationErrors('quantity');
    }

    public function test_checkout_fails_atomically_when_stock_ran_out_meanwhile(): void
    {
        $ok = Product::factory()->for($this->sellerA, 'seller')->withStock(5)->create();
        $scarce = Product::factory()->for($this->sellerB, 'seller')->withStock(2)->create();

        $this->addToCart($ok, 1);
        $this->addToCart($scarce, 2);

        // Another buyer takes the last units after we filled our cart.
        $scarce->inventory()->update(['quantity' => 1]);

        $this->checkout()->assertUnprocessable()->assertJsonValidationErrors('stock');

        // Nothing was written and no stock was taken from the other product.
        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(5, $ok->inventory()->value('quantity'));
        $this->assertSame(1, $scarce->inventory()->value('quantity'));
    }

    public function test_customer_cancel_restocks_and_reverses_commission(): void
    {
        $p = Product::factory()->for($this->sellerA, 'seller')->withStock(5)->create();
        $this->addToCart($p, 2);
        $orderId = $this->checkout()->json('id');

        $this->actingAsRole($this->customer)->postJson("/api/orders/{$orderId}/cancel")
            ->assertOk()->assertJsonPath('status', 'cancelled');

        $this->assertSame(5, $p->inventory()->value('quantity'));
        $this->assertDatabaseHas('commission_records', ['seller_id' => $this->sellerA->id, 'status' => 'reversed']);
        $this->assertDatabaseHas('payments', ['order_id' => $orderId, 'status' => 'failed']);
    }

    public function test_fulfilment_flow_completes_order_and_marks_cod_paid(): void
    {
        $p = Product::factory()->for($this->sellerA, 'seller')->withStock(5)->create(['price' => 100]);
        $this->addToCart($p, 1);
        $order = $this->checkout()->json();
        $soId = $order['seller_orders'][0]['id'];

        $seller = $this->actingAsRole($this->sellerA);
        $seller->patchJson("/api/seller/orders/{$soId}/status", ['status' => 'shipped', 'courier' => 'LBC'])
            ->assertUnprocessable(); // must confirm and pack first

        foreach (['confirmed', 'packed'] as $s) {
            $seller->patchJson("/api/seller/orders/{$soId}/status", ['status' => $s])->assertOk();
        }
        $seller->patchJson("/api/seller/orders/{$soId}/status", ['status' => 'shipped'])->assertJsonValidationErrors('courier');
        $seller->patchJson("/api/seller/orders/{$soId}/status", ['status' => 'shipped', 'courier' => 'LBC', 'tracking_number' => 'LBC123'])
            ->assertOk()->assertJsonPath('shipment.tracking_number', 'LBC123');
        $seller->patchJson("/api/seller/orders/{$soId}/status", ['status' => 'delivered'])->assertOk();

        $this->assertDatabaseHas('orders', ['id' => $order['id'], 'status' => 'completed', 'payment_status' => 'paid']);
        $this->assertDatabaseHas('commission_records', ['seller_order_id' => $soId, 'status' => 'payable']);

        // Other sellers can't see it.
        $this->actingAsRole($this->sellerB)->getJson("/api/seller/orders/{$soId}")->assertForbidden();
    }

    public function test_review_only_after_delivery_and_once(): void
    {
        $p = Product::factory()->for($this->sellerA, 'seller')->withStock(5)->create();
        $this->addToCart($p, 1);
        $order = $this->checkout()->json();
        $itemId = $order['seller_orders'][0]['items'][0]['id'];
        $soId = $order['seller_orders'][0]['id'];

        $this->actingAsRole($this->customer)->postJson("/api/order-items/{$itemId}/review", ['rating' => 5])
            ->assertUnprocessable();

        foreach ([['status' => 'confirmed'], ['status' => 'packed'], ['status' => 'shipped', 'courier' => 'LBC'], ['status' => 'delivered']] as $step) {
            $this->actingAsRole($this->sellerA)->patchJson("/api/seller/orders/{$soId}/status", $step)->assertOk();
        }

        $this->actingAsRole($this->customer)->postJson("/api/order-items/{$itemId}/review", ['rating' => 4, 'body' => 'Nice'])
            ->assertCreated();
        $this->actingAsRole($this->customer)->postJson("/api/order-items/{$itemId}/review", ['rating' => 5])
            ->assertUnprocessable();

        $this->assertEquals(4.0, (float) $p->fresh()->rating_avg);
        $this->assertSame(1, $p->fresh()->rating_count);
    }
}
