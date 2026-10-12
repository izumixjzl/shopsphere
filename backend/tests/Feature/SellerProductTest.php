<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SellerProductTest extends TestCase
{
    use RefreshDatabase;

    public function test_seller_creates_product_with_stock_and_images(): void
    {
        Storage::fake('local');
        $seller = User::factory()->seller()->create();
        $category = Category::factory()->create();

        $this->actingAsRole($seller)->post('/api/seller/products', [
            'category_id' => $category->id, 'name' => 'Test Mug', 'sku' => 'MUG-001',
            'price' => 299.50, 'status' => 'active', 'stock' => 3, 'low_stock_threshold' => 5,
            'images' => [UploadedFile::fake()->image('a.jpg'), UploadedFile::fake()->image('b.jpg')],
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('stock', 3)
            ->assertJsonPath('is_low_stock', true)
            ->assertJsonCount(2, 'images');

        // Low stock triggered a notification for the seller.
        $this->assertDatabaseHas('notifications', ['user_id' => $seller->id, 'type' => 'inventory.low_stock']);
    }

    public function test_sku_is_unique_per_seller_only(): void
    {
        $a = User::factory()->seller()->create();
        $b = User::factory()->seller()->create();
        $category = Category::factory()->create();
        Product::factory()->for($a, 'seller')->create(['sku' => 'SAME-1', 'category_id' => $category->id]);

        $payload = ['category_id' => $category->id, 'name' => 'X', 'sku' => 'SAME-1', 'price' => 10, 'status' => 'draft', 'stock' => 1];

        $this->actingAsRole($a)->postJson('/api/seller/products', $payload)->assertJsonValidationErrors('sku');
        $this->actingAsRole($b)->postJson('/api/seller/products', $payload)->assertCreated();
    }

    public function test_seller_cannot_touch_another_sellers_product(): void
    {
        $owner = User::factory()->seller()->create();
        $intruder = User::factory()->seller()->create();
        $product = Product::factory()->for($owner, 'seller')->withStock(5)->create();

        $this->actingAsRole($intruder)->postJson("/api/seller/products/{$product->id}", ['price' => 1])->assertForbidden();
        $this->actingAsRole($intruder)->patchJson("/api/seller/products/{$product->id}/stock", ['stock' => 0])->assertForbidden();
        $this->actingAsRole($intruder)->deleteJson("/api/seller/products/{$product->id}")->assertForbidden();
    }

    public function test_catalog_hides_unapproved_and_moderated_listings(): void
    {
        $approved = User::factory()->seller()->create();
        $pending = User::factory()->seller(\App\Enums\SellerStatus::Pending)->create();

        $visible = Product::factory()->for($approved, 'seller')->withStock(5)->create();
        Product::factory()->for($pending, 'seller')->withStock(5)->create();
        Product::factory()->for($approved, 'seller')->withStock(5)->create(['status' => 'draft']);
        $flagged = Product::factory()->for($approved, 'seller')->withStock(5)->create();
        $flagged->forceFill(['moderation_status' => 'removed'])->save();

        $this->getJson('/api/products')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $visible->id);
    }
}
