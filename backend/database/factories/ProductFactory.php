<?php

namespace Database\Factories;

use App\Enums\ProductStatus;
use App\Models\Category;
use App\Models\Inventory;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * Usage: Product::factory()->for($seller, 'seller')->withStock(10)->create()
 *
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    public function definition(): array
    {
        $name = ucfirst(fake()->unique()->words(3, true));

        return [
            'category_id' => Category::factory(),
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(4)),
            'sku' => strtoupper(Str::random(8)),
            'short_description' => fake()->sentence(),
            'description' => fake()->paragraphs(2, true),
            'price' => fake()->randomFloat(2, 100, 5000),
            'status' => ProductStatus::Active,
        ];
    }

    public function withStock(int $quantity, int $threshold = 5): static
    {
        return $this->afterCreating(function (Product $product) use ($quantity, $threshold) {
            Inventory::create(['product_id' => $product->id, 'quantity' => $quantity, 'low_stock_threshold' => $threshold]);
        });
    }
}
