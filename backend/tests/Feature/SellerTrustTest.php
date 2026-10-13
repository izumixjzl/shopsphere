<?php

namespace Tests\Feature;

use App\Enums\SellerOrderStatus;
use App\Enums\SellerStatus;
use App\Models\Address;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\SellerOrder;
use App\Models\SellerProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SellerTrustTest extends TestCase
{
    use RefreshDatabase;

    private function profileOf(User $seller): SellerProfile
    {
        return SellerProfile::where('user_id', $seller->id)->firstOrFail();
    }

    public function test_store_cannot_be_approved_without_an_accepted_document(): void
    {
        $seller = User::factory()->seller(SellerStatus::Pending)->create();
        $admin = User::factory()->admin()->create();
        $profile = $this->profileOf($seller);
        $doc = $profile->verifications()->forceCreate(['document_type' => 'dti', 'document_url' => 'verifications/a.pdf', 'status' => 'pending']);

        $this->actingAsRole($admin)->postJson("/api/admin/sellers/{$profile->id}/approve")
            ->assertUnprocessable()->assertJsonValidationErrors('status');

        $this->patchJson("/api/admin/verifications/{$doc->id}", ['status' => 'rejected'])
            ->assertUnprocessable()->assertJsonValidationErrors('notes'); // seller must be told why
        $this->patchJson("/api/admin/verifications/{$doc->id}", ['status' => 'approved'])->assertOk();
        $this->assertDatabaseHas('notifications', ['user_id' => $seller->id, 'type' => 'seller.verification_approved']);

        $this->postJson("/api/admin/sellers/{$profile->id}/approve")->assertOk()->assertJsonPath('status', 'approved');
    }

    public function test_only_pending_applications_can_be_rejected_and_only_approved_stores_suspended(): void
    {
        $admin = User::factory()->admin()->create();
        $approved = $this->profileOf(User::factory()->seller()->create());
        $pending = $this->profileOf(User::factory()->seller(SellerStatus::Pending)->create());

        $this->actingAsRole($admin)->postJson("/api/admin/sellers/{$approved->id}/reject", ['reason' => 'x'])->assertUnprocessable();
        $this->postJson("/api/admin/sellers/{$pending->id}/suspend", ['reason' => 'x'])->assertUnprocessable();
    }

    public function test_suspended_seller_can_appeal_and_admin_acceptance_reinstates_the_store(): void
    {
        $seller = User::factory()->seller()->create();
        $admin = User::factory()->admin()->create();
        $profile = $this->profileOf($seller);
        $product = Product::factory()->for($seller, 'seller')->withStock(5)->create();

        // Approved sellers have nothing to appeal.
        $this->actingAsRole($seller)->postJson('/api/seller/appeals', ['message' => str_repeat('Please review. ', 3)])
            ->assertUnprocessable();

        $this->actingAsRole($admin)->postJson("/api/admin/sellers/{$profile->id}/suspend", ['reason' => 'Counterfeit goods'])
            ->assertOk()->assertJsonPath('status', 'suspended');
        $this->assertNotNull($profile->fresh()->suspended_at);
        $this->getJson("/api/products/{$product->slug}")->assertNotFound(); // listings hidden

        $this->actingAsRole($seller->fresh())->postJson('/api/seller/appeals', ['message' => 'These are genuine items; invoices attached to my DTI file.'])
            ->assertCreated()->assertJsonPath('status', 'open')->assertJsonPath('suspension_reason', 'Counterfeit goods');
        $this->postJson('/api/seller/appeals', ['message' => 'Another appeal while one is still open.'])
            ->assertUnprocessable();
        $this->getJson('/api/seller/appeals')->assertOk()->assertJsonCount(1);

        $appealId = $profile->appeals()->value('id');
        $this->actingAsRole($admin)->getJson('/api/admin/sellers?appeal=open')->assertOk()->assertJsonPath('data.0.id', $profile->id);
        $this->postJson("/api/admin/seller-appeals/{$appealId}/decide", ['status' => 'denied'])
            ->assertUnprocessable()->assertJsonValidationErrors('admin_note');
        $this->postJson("/api/admin/seller-appeals/{$appealId}/decide", ['status' => 'accepted', 'admin_note' => 'Invoices check out.'])
            ->assertOk()->assertJsonPath('status', 'approved')->assertJsonPath('appeals.0.status', 'accepted');

        $this->postJson("/api/admin/seller-appeals/{$appealId}/decide", ['status' => 'denied', 'admin_note' => 'x'])->assertStatus(422);
        $this->getJson("/api/products/{$product->slug}")->assertOk();
        $this->assertDatabaseHas('notifications', ['user_id' => $seller->id, 'type' => 'seller.appeal_accepted']);

        $trust = $this->getJson("/api/admin/sellers/{$profile->id}/trust")->assertOk();
        $this->assertSame(1, $trust->json('suspensions'));
        $this->assertSame(['seller.appeal_accepted', 'seller.appeal_filed', 'seller.suspended'],
            array_column($trust->json('history'), 'action'));
    }

    public function test_reinstating_directly_closes_the_open_appeal(): void
    {
        $seller = User::factory()->seller(SellerStatus::Suspended)->create();
        $admin = User::factory()->admin()->create();
        $profile = $this->profileOf($seller);

        $this->actingAsRole($seller)->postJson('/api/seller/appeals', ['message' => 'I fixed every flagged listing last week.'])->assertCreated();

        // No document needed to reinstate an already-vetted store.
        $this->actingAsRole($admin)->postJson("/api/admin/sellers/{$profile->id}/approve")->assertOk()
            ->assertJsonPath('status', 'approved')->assertJsonPath('appeals.0.status', 'accepted');
        $this->assertDatabaseHas('audit_logs', ['action' => 'seller.reinstated']);
    }

    public function test_seller_rating_comes_from_verified_purchase_reviews(): void
    {
        $seller = User::factory()->seller()->create();
        $customer = User::factory()->create();
        $address = Address::factory()->for($customer)->create();
        $p1 = Product::factory()->for($seller, 'seller')->withStock(10)->create();
        $p2 = Product::factory()->for($seller, 'seller')->withStock(10)->create();

        $this->actingAsRole($customer);
        $this->postJson('/api/cart/items', ['product_id' => $p1->id, 'quantity' => 1])->assertCreated();
        $this->postJson('/api/cart/items', ['product_id' => $p2->id, 'quantity' => 1])->assertCreated();
        $this->postJson('/api/orders', ['address_id' => $address->id, 'payment_method' => 'cod'])->assertCreated();

        $items = OrderItem::where('seller_id', $seller->id)->orderBy('id')->get();

        // Not delivered yet: no review, no rating.
        $this->postJson("/api/order-items/{$items[0]->id}/review", ['rating' => 5])->assertUnprocessable();

        SellerOrder::where('seller_id', $seller->id)->update(['status' => SellerOrderStatus::Delivered]);
        $this->postJson("/api/order-items/{$items[0]->id}/review", ['rating' => 5])->assertCreated();
        $this->postJson("/api/order-items/{$items[1]->id}/review", ['rating' => 2])->assertCreated();

        $profile = $this->profileOf($seller);
        $this->assertSame(2, $profile->rating_count);
        $this->assertEquals(3.5, (float) $profile->rating_avg);

        $this->getJson("/api/stores/{$profile->store_slug}")->assertOk()
            ->assertJsonPath('stats.rating_count', 2)->assertJsonPath('stats.rating', 3.5);
        $this->getJson("/api/stores/{$profile->store_slug}/reviews")->assertOk()
            ->assertJsonPath('meta.total', 2)->assertJsonPath('data.0.verified_purchase', true);
    }

    public function test_listing_is_hidden_after_reports_from_several_customers(): void
    {
        config(['marketplace.auto_flag_report_threshold' => 2]);
        $seller = User::factory()->seller()->create();
        $product = Product::factory()->for($seller, 'seller')->withStock(5)->create();
        [$a, $b] = User::factory()->count(2)->create();

        $this->actingAsRole($a)->postJson("/api/products/{$product->id}/reports", ['reason' => 'counterfeit'])->assertCreated();
        $this->assertSame('approved', $product->fresh()->moderation_status);

        $this->actingAsRole($b)->postJson("/api/products/{$product->id}/reports", ['reason' => 'scam'])->assertCreated();
        $this->assertSame('flagged', $product->fresh()->moderation_status);
        $this->getJson("/api/products/{$product->slug}")->assertNotFound();
        $this->assertDatabaseHas('notifications', ['user_id' => $seller->id, 'type' => 'product.flagged']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'product.auto_flagged']);
    }
}
