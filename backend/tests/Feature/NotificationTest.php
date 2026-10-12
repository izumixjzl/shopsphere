<?php

namespace Tests\Feature;

use App\Events\NotificationCreated;
use App\Mail\NotificationMail;
use App\Models\Notification;
use App\Models\Product;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_send_stores_broadcasts_and_emails_with_a_role_aware_link(): void
    {
        Event::fake([NotificationCreated::class]);
        Mail::fake();
        $seller = User::factory()->seller()->create();

        $n = app(NotificationService::class)->send($seller, 'seller_order.new', 'New order', 'You have a new order.', ['seller_order_id' => 7]);

        $this->assertSame('/seller/orders/7', $n->data['url']);
        Event::assertDispatched(NotificationCreated::class, fn ($e) => $e->notification->is($n)
            && $e->broadcastOn()->name === "private-App.Models.User.{$seller->id}");
        Mail::assertQueued(NotificationMail::class, fn ($m) => $m->hasTo($seller->email));
    }

    public function test_email_can_be_switched_off_and_skips_suspended_users(): void
    {
        Mail::fake();
        $service = app(NotificationService::class);

        $service->send(User::factory()->suspended()->create(), 'order.placed', 'T', 'M');
        config(['marketplace.email_notifications' => false]);
        $service->send(User::factory()->create(), 'order.placed', 'T', 'M');

        Mail::assertNothingQueued();
    }

    public function test_users_mark_their_own_notifications_read_only(): void
    {
        $me = User::factory()->create();
        $other = User::factory()->create();
        $mine = Notification::create(['user_id' => $me->id, 'type' => 'x', 'title' => 'T', 'message' => 'M']);
        $theirs = Notification::create(['user_id' => $other->id, 'type' => 'x', 'title' => 'T', 'message' => 'M']);

        $this->actingAsRole($me)->getJson('/api/notifications')->assertJsonPath('unread_count', 1)->assertJsonCount(1, 'data');
        $this->actingAsRole($me)->postJson("/api/notifications/{$theirs->id}/read")->assertNotFound();
        $this->actingAsRole($me)->postJson("/api/notifications/{$mine->id}/read")->assertOk();

        $this->assertNotNull($mine->fresh()->read_at);
        $this->assertNull($theirs->fresh()->read_at);
    }

    public function test_older_notifications_without_a_stored_link_still_get_one(): void
    {
        $seller = User::factory()->seller()->create();
        Notification::create(['user_id' => $seller->id, 'type' => 'seller_order.new', 'title' => 'T', 'message' => 'M', 'data' => ['seller_order_id' => 29]]);

        $this->actingAsRole($seller)->getJson('/api/notifications')->assertJsonPath('data.0.data.url', '/seller/orders/29');
    }

    public function test_customer_reports_listing_and_admin_resolves_it(): void
    {
        $admin = User::factory()->admin()->create();
        $customer = User::factory()->create();
        $product = Product::factory()->for(User::factory()->seller(), 'seller')->withStock(3)->create();

        $this->actingAsRole($customer)->postJson("/api/products/{$product->id}/reports", ['reason' => 'other'])
            ->assertJsonValidationErrors('details');
        $this->actingAsRole($customer)->postJson("/api/products/{$product->id}/reports", ['reason' => 'counterfeit'])
            ->assertCreated();
        $this->actingAsRole($customer)->postJson("/api/products/{$product->id}/reports", ['reason' => 'scam'])
            ->assertJsonValidationErrors('reason'); // one open report per listing

        $this->assertDatabaseHas('notifications', ['user_id' => $admin->id, 'type' => 'product_report.new']);

        $report = $this->actingAsRole($admin)->getJson('/api/admin/reports?status=open')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reason_label', 'Counterfeit or fake item')
            ->json('data.0');

        $this->actingAsRole($admin)->postJson("/api/admin/reports/{$report['id']}/resolve", ['status' => 'resolved', 'admin_note' => 'Listing removed'])
            ->assertOk()->assertJsonPath('status', 'resolved');
        $this->actingAsRole($admin)->postJson("/api/admin/reports/{$report['id']}/resolve", ['status' => 'dismissed'])
            ->assertStatus(422);

        $this->assertDatabaseHas('notifications', ['user_id' => $customer->id, 'type' => 'product_report.resolved']);
    }

    public function test_only_customers_report_and_only_admins_review(): void
    {
        $seller = User::factory()->seller()->create();
        $product = Product::factory()->for($seller, 'seller')->withStock(3)->create();

        $this->actingAsRole($seller)->postJson("/api/products/{$product->id}/reports", ['reason' => 'scam'])->assertForbidden();
        $this->actingAsRole(User::factory()->create())->getJson('/api/admin/reports')->assertForbidden();
    }
}
