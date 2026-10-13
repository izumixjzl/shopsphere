<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use App\Payments\GatewayRegistry;
use App\Payments\SandboxGateway;
use App\Payments\WebhookEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;
    private User $seller;
    private Address $address;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'marketplace.shipping_fee_per_seller' => 50,
            'payments.gateways.sandbox.enabled' => true,
            'payments.gateways.sandbox.webhook_secret' => 'test-secret',
        ]);

        $this->customer = User::factory()->create();
        $this->address = Address::factory()->for($this->customer)->create();
        $this->seller = User::factory()->seller()->create();
        $this->product = Product::factory()->for($this->seller, 'seller')->withStock(10)->create(['price' => 100]);
    }

    private function fillCart(int $qty = 2): void
    {
        $this->actingAsRole($this->customer)->postJson('/api/cart/items', ['product_id' => $this->product->id, 'quantity' => $qty])->assertCreated();
    }

    private function checkout(array $body = [], ?string $key = null)
    {
        return $this->actingAsRole($this->customer)->withHeaders($key ? ['Idempotency-Key' => $key] : [])
            ->postJson('/api/orders', $body + ['address_id' => $this->address->id, 'payment_method' => 'cod']);
    }

    private function gateway(): SandboxGateway
    {
        return app(GatewayRegistry::class)->get('sandbox');
    }

    private function postWebhook(string $body, array $headers)
    {
        return $this->call('POST', '/api/webhooks/payments/sandbox', [], [], [],
            collect($headers)->mapWithKeys(fn ($v, $k) => ['HTTP_'.strtoupper(str_replace('-', '_', $k)) => $v])->all()
                + ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'],
            $body);
    }

    // ---- Duplicate protection & server-side totals ------------------------------

    public function test_retrying_checkout_with_the_same_key_returns_the_first_order(): void
    {
        $this->fillCart(2);

        $first = $this->checkout([], 'checkout-abc-123')->assertCreated();
        $this->checkout([], 'checkout-abc-123')->assertOk()->assertJsonPath('id', $first->json('id'));

        $this->assertSame(1, Order::count());
        $this->assertSame(8, $this->product->inventory()->value('quantity')); // stock deducted once
        $this->assertDatabaseCount('payments', 1);

        // A new key is a new checkout: the cart is empty now.
        $this->checkout([], 'checkout-def-456')->assertUnprocessable()->assertJsonValidationErrors('cart');
        $this->checkout([], 'bad key!')->assertJsonValidationErrors('idempotency_key');
    }

    public function test_client_prices_are_ignored_and_a_changed_total_blocks_the_order(): void
    {
        $this->fillCart(2);
        $this->product->update(['price' => 120]); // changed after the customer opened checkout

        $this->checkout(['expected_total' => '250.00', 'subtotal' => 1, 'price' => 1])
            ->assertUnprocessable()->assertJsonValidationErrors('expected_total');
        $this->assertSame(0, Order::count());
        $this->assertSame(10, $this->product->inventory()->value('quantity')); // nothing held

        $this->checkout(['expected_total' => '290.00'])->assertCreated()
            ->assertJsonPath('subtotal', '240.00')->assertJsonPath('shipping_total', '50.00')->assertJsonPath('grand_total', '290.00');
    }

    // ---- Online payments ----------------------------------------------------------

    public function test_online_order_waits_for_payment_before_sellers_can_act(): void
    {
        $this->fillCart(2);
        $res = $this->checkout(['payment_method' => 'sandbox'])->assertCreated()
            ->assertJsonPath('payment_method', 'sandbox')->assertJsonPath('payment_status', 'unpaid')
            ->assertJsonPath('payments.0.status', 'pending');
        $this->assertStringStartsWith('/sandbox-pay/sbx_', $res->json('payments.0.checkout_url'));
        $this->assertNotNull($res->json('payment_due_at'));

        // Sellers aren't told yet and can't start fulfilment.
        $this->assertDatabaseMissing('notifications', ['user_id' => $this->seller->id, 'type' => 'seller_order.new']);
        $soId = $res->json('seller_orders.0.id');
        $this->actingAsRole($this->seller)->patchJson("/api/seller/orders/{$soId}/status", ['status' => 'confirmed'])
            ->assertJsonValidationErrors('status');

        // "Pay now" twice reuses the same open attempt.
        $this->actingAsRole($this->customer);
        $a = $this->postJson("/api/orders/{$res->json('id')}/pay")->assertOk()->json('data.id');
        $b = $this->postJson("/api/orders/{$res->json('id')}/pay")->assertOk()->json('data.id');
        $this->assertSame($a, $b);
        $this->assertDatabaseCount('payments', 1);
    }

    public function test_signed_webhook_marks_paid_once_and_rejects_forgeries(): void
    {
        $this->fillCart(2);
        $orderId = $this->checkout(['payment_method' => 'sandbox'])->json('id');
        $payment = Payment::where('order_id', $orderId)->first();

        [$body, $headers] = $this->gateway()->simulateWebhook($payment, WebhookEvent::PAID);

        // Tampered body, wrong secret and stale timestamp are all refused.
        $this->postWebhook(str_replace('payment.paid', 'payment.failed', $body), $headers)->assertStatus(400);
        $this->postWebhook($body, ['x-sandbox-signature' => 't='.time().',v1=deadbeef'])->assertStatus(400);
        $this->postWebhook($body, $this->gateway()->headersFor($body, time() - 3600))->assertStatus(400);
        $this->assertSame('pending', $payment->fresh()->status);

        $this->postWebhook($body, $headers)->assertOk()->assertJsonPath('status', 'processed');
        $this->postWebhook($body, $headers)->assertOk()->assertJsonPath('status', 'duplicate'); // redelivery

        $this->assertSame('paid', $payment->fresh()->status);
        $this->assertSame('paid', Order::find($orderId)->payment_status);
        $this->assertDatabaseCount('webhook_events', 1);
        $this->assertDatabaseHas('notifications', ['user_id' => $this->seller->id, 'type' => 'seller_order.new']);

        // A late "failed" event can't undo a captured payment.
        [$failBody, $failHeaders] = $this->gateway()->simulateWebhook($payment, WebhookEvent::FAILED);
        $this->postWebhook($failBody, $failHeaders)->assertOk()->assertJsonPath('status', 'ignored');
        $this->assertSame('paid', $payment->fresh()->status);

        // Now the seller can fulfil it.
        $soId = Order::find($orderId)->sellerOrders()->value('id');
        $this->actingAsRole($this->seller)->patchJson("/api/seller/orders/{$soId}/status", ['status' => 'confirmed'])->assertOk();
    }

    public function test_wrong_amount_is_rejected_and_admins_are_alerted(): void
    {
        $admin = User::factory()->admin()->create();
        $this->fillCart(1);
        $orderId = $this->checkout(['payment_method' => 'sandbox'])->json('id');
        $payment = Payment::where('order_id', $orderId)->first();

        [$body, $headers] = $this->gateway()->simulateWebhook($payment, WebhookEvent::PAID, amountCents: 100);
        $this->postWebhook($body, $headers)->assertOk()->assertJsonPath('status', 'rejected');

        $this->assertSame('pending', $payment->fresh()->status);
        $this->assertDatabaseHas('notifications', ['user_id' => $admin->id, 'type' => 'payment.amount_mismatch']);
    }

    public function test_failed_payment_can_be_retried_with_a_new_attempt(): void
    {
        $this->fillCart(1);
        $orderId = $this->checkout(['payment_method' => 'sandbox'])->json('id');
        $first = Payment::where('order_id', $orderId)->first();

        $this->postJson("/api/sandbox/payments/{$first->transaction_reference}/complete", ['outcome' => 'failed'])
            ->assertOk()->assertJsonPath('data.status', 'failed');
        $this->assertDatabaseHas('notifications', ['user_id' => $this->customer->id, 'type' => 'order.payment_failed']);

        $retry = $this->postJson("/api/orders/{$orderId}/pay")->assertOk()->json('data');
        $this->assertNotSame($first->id, $retry['id']);

        $second = Payment::find($retry['id']);
        $this->postJson("/api/sandbox/payments/{$second->transaction_reference}/complete", ['outcome' => 'paid'])->assertOk();

        $this->getJson("/api/orders/{$orderId}")->assertOk()->assertJsonPath('payment_status', 'paid')
            ->assertJsonCount(2, 'payments')->assertJsonPath('payments.0.status', 'paid')->assertJsonPath('payments.1.status', 'failed');

        // Another customer can't see or complete this sandbox payment.
        $this->actingAsRole(User::factory()->create())->getJson("/api/sandbox/payments/{$second->transaction_reference}")->assertNotFound();
    }

    public function test_unpaid_orders_expire_and_a_late_payment_is_flagged_for_refund(): void
    {
        $admin = User::factory()->admin()->create();
        $this->fillCart(3);
        $orderId = $this->checkout(['payment_method' => 'sandbox'])->json('id');
        $payment = Payment::where('order_id', $orderId)->first();
        $this->assertSame(7, $this->product->inventory()->value('quantity'));

        $this->travel(31)->minutes();
        $this->artisan('payments:expire')->assertSuccessful();

        $order = Order::find($orderId);
        $this->assertSame('cancelled', $order->status->value);
        $this->assertSame('expired', $payment->fresh()->status);
        $this->assertSame(10, $this->product->inventory()->value('quantity')); // stock released
        $this->actingAsRole($this->customer)->postJson("/api/orders/{$orderId}/pay")->assertUnprocessable();

        // The provider captured the money anyway: record it, keep the order cancelled, tell admins.
        [$body, $headers] = $this->gateway()->simulateWebhook($payment, WebhookEvent::PAID);
        $this->postWebhook($body, $headers)->assertOk()->assertJsonPath('status', 'processed');

        $this->assertSame('paid', $payment->fresh()->status);
        $this->assertTrue($payment->fresh()->meta['needs_refund']);
        $this->assertSame('cancelled', Order::find($orderId)->status->value);
        $this->assertDatabaseHas('notifications', ['user_id' => $admin->id, 'type' => 'payment.needs_refund']);
    }

    public function test_cancelling_an_unpaid_online_order_closes_the_open_attempt(): void
    {
        $this->fillCart(1);
        $orderId = $this->checkout(['payment_method' => 'sandbox'])->json('id');

        $this->postJson("/api/orders/{$orderId}/cancel")->assertOk()->assertJsonPath('status', 'cancelled');
        $this->assertSame('cancelled', Payment::where('order_id', $orderId)->value('status'));
    }

    public function test_disabled_gateway_is_not_offered(): void
    {
        config(['payments.gateways.sandbox.enabled' => false]);
        $this->fillCart(1);

        $this->actingAsRole($this->customer)->getJson('/api/checkout/payment-methods')->assertOk()->assertJsonCount(1, 'data');
        $this->checkout(['payment_method' => 'sandbox'])->assertJsonValidationErrors('payment_method');
        $this->postWebhook('{}', [])->assertNotFound();
    }
}
