<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourierTest extends TestCase
{
    use RefreshDatabase;

    private User $seller;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seller = User::factory()->seller()->create();
    }

    /** A placed, confirmed and packed seller order, ready to ship. */
    private function packedOrder(): int
    {
        $customer = User::factory()->create();
        $address = Address::factory()->for($customer)->create();
        $product = Product::factory()->for($this->seller, 'seller')->withStock(5)->create();

        $this->actingAsRole($customer)->postJson('/api/cart/items', ['product_id' => $product->id, 'quantity' => 1])->assertCreated();
        $soId = $this->postJson('/api/orders', ['address_id' => $address->id, 'payment_method' => 'cod'])->json('seller_orders.0.id');

        foreach (['confirmed', 'packed'] as $s) {
            $this->actingAsRole($this->seller)->patchJson("/api/seller/orders/{$soId}/status", ['status' => $s])->assertOk();
        }

        return $soId;
    }

    public function test_known_courier_code_stores_code_and_display_name(): void
    {
        $soId = $this->packedOrder();

        $this->patchJson("/api/seller/orders/{$soId}/status", ['status' => 'shipped', 'courier_code' => 'jnt', 'courier' => 'ignored'])
            ->assertOk()->assertJsonPath('shipment.courier_code', 'jnt')->assertJsonPath('shipment.courier', 'J&T Express');
    }

    public function test_other_courier_needs_a_name_and_unknown_codes_are_rejected(): void
    {
        $soId = $this->packedOrder();

        $this->patchJson("/api/seller/orders/{$soId}/status", ['status' => 'shipped', 'courier_code' => 'dhl-xyz'])
            ->assertJsonValidationErrors('courier_code');
        $this->patchJson("/api/seller/orders/{$soId}/status", ['status' => 'shipped', 'courier_code' => 'other'])
            ->assertJsonValidationErrors(['courier' => 'Enter the courier name.']);
        $this->patchJson("/api/seller/orders/{$soId}/status", ['status' => 'shipped', 'courier_code' => 'other', 'courier' => ' Entrego '])
            ->assertOk()->assertJsonPath('shipment.courier_code', 'other')->assertJsonPath('shipment.courier', 'Entrego');
    }

    public function test_typed_names_without_a_code_still_map_to_the_list(): void
    {
        $soId = $this->packedOrder();

        $this->patchJson("/api/seller/orders/{$soId}/status", ['status' => 'shipped', 'courier' => 'lbc'])
            ->assertOk()->assertJsonPath('shipment.courier_code', 'lbc')->assertJsonPath('shipment.courier', 'LBC Express');
    }

    public function test_courier_list_remembers_the_sellers_last_choice(): void
    {
        $this->actingAsRole($this->seller)->getJson('/api/couriers')->assertOk()
            ->assertJsonPath('data.0.code', 'jnt')->assertJsonPath('last', null);

        $soId = $this->packedOrder();
        $this->patchJson("/api/seller/orders/{$soId}/status", ['status' => 'shipped', 'courier_code' => 'ninjavan'])->assertOk();

        $this->getJson('/api/couriers')->assertJsonPath('last.code', 'ninjavan');
        $this->actingAsRole(User::factory()->create())->getJson('/api/couriers')->assertForbidden();
    }
}
