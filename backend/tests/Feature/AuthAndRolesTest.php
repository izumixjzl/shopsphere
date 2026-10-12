<?php

namespace Tests\Feature;

use App\Enums\SellerStatus;
use App\Models\SellerProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthAndRolesTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_register_and_receives_token(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Juan', 'email' => 'juan@example.com', 'role' => 'customer',
            'password' => 'secret123', 'password_confirmation' => 'secret123',
        ])->assertCreated()
            ->assertJsonPath('user.role', 'customer')
            ->assertJsonStructure(['token']);
    }

    public function test_nobody_can_self_register_as_admin(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Hacker', 'email' => 'h@example.com', 'role' => 'admin',
            'password' => 'secret123', 'password_confirmation' => 'secret123',
        ])->assertUnprocessable()->assertJsonValidationErrors('role');
    }

    public function test_seller_registration_creates_pending_store(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Ana', 'email' => 'ana@example.com', 'role' => 'seller', 'store_name' => 'Ana Goods',
            'password' => 'secret123', 'password_confirmation' => 'secret123',
        ])->assertCreated()->assertJsonPath('user.seller_profile.status', 'pending');

        $this->assertDatabaseHas('seller_profiles', ['store_slug' => 'ana-goods', 'status' => 'pending']);
    }

    public function test_login_rejects_wrong_password_and_suspended_users(): void
    {
        User::factory()->create(['email' => 'a@example.com']);
        User::factory()->suspended()->create(['email' => 's@example.com']);

        $this->postJson('/api/auth/login', ['email' => 'a@example.com', 'password' => 'nope'])->assertUnprocessable();
        $this->postJson('/api/auth/login', ['email' => 's@example.com', 'password' => 'password123'])->assertUnprocessable();
        $this->postJson('/api/auth/login', ['email' => 'a@example.com', 'password' => 'password123'])->assertOk();
    }

    public function test_pending_seller_cannot_manage_products_until_approved(): void
    {
        $seller = User::factory()->seller(SellerStatus::Pending)->create();
        $admin = User::factory()->admin()->create();

        $this->actingAsRole($seller)->getJson('/api/seller/products')->assertForbidden();
        $this->getJson('/api/seller/store')->assertOk(); // profile is still editable

        $profile = SellerProfile::where('user_id', $seller->id)->first();
        $this->actingAsRole($admin)->postJson("/api/admin/sellers/{$profile->id}/approve")->assertOk()
            ->assertJsonPath('status', 'approved');

        $this->actingAsRole($seller->fresh())->getJson('/api/seller/products')->assertOk();
        $this->assertDatabaseHas('audit_logs', ['action' => 'seller.approved']);
        $this->assertDatabaseHas('notifications', ['user_id' => $seller->id, 'type' => 'seller.approved']);
    }

    public function test_roles_cannot_reach_other_areas(): void
    {
        $customer = User::factory()->create();
        $seller = User::factory()->seller()->create();

        $this->actingAsRole($customer)->getJson('/api/admin/dashboard')->assertForbidden();
        $this->actingAsRole($customer)->getJson('/api/seller/dashboard')->assertForbidden();
        $this->actingAsRole($seller)->getJson('/api/cart')->assertForbidden();
        $this->actingAsRole($seller)->getJson('/api/admin/users')->assertForbidden();
    }
}
