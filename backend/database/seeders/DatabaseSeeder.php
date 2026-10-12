<?php

namespace Database\Seeders;

use App\Enums\SellerOrderStatus;
use App\Enums\SellerStatus;
use App\Models\Address;
use App\Models\Cart;
use App\Models\Category;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\User;
use App\Services\CheckoutService;
use App\Services\SellerOrderService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Demo data. Every account uses the password "password123".
 *
 *   admin@shopsphere.test       super admin
 *   seller1..3@shopsphere.test  approved sellers
 *   pending@shopsphere.test     seller awaiting approval
 *   customer@shopsphere.test    customer with past orders
 */
class DatabaseSeeder extends Seeder
{
    private const CATALOG = [
        'Electronics' => [
            'Audio' => [['Wireless Earbuds Pro', 2499], ['Bluetooth Speaker Mini', 1299], ['Studio Headphones', 3999]],
            'Accessories' => [['65W USB-C Charger', 899], ['Braided Lightning Cable', 349], ['Laptop Stand Aluminum', 1499]],
        ],
        'Fashion' => [
            'Men' => [['Classic Oxford Shirt', 1199], ['Slim Chino Pants', 1399], ['Canvas Sneakers', 1899]],
            'Women' => [['Linen Wrap Dress', 1699], ['Woven Tote Bag', 999], ['Everyday Flats', 1299]],
        ],
        'Home & Living' => [
            'Kitchen' => [['Cast Iron Skillet 10"', 1599], ['Ceramic Mug Set (4)', 699], ['Bamboo Cutting Board', 549]],
            'Decor' => [['Rattan Pendant Lamp', 2299], ['Linen Throw Pillow', 599], ['Indoor Plant Pot Set', 799]],
        ],
        'Health & Beauty' => [
            'Skincare' => [['Vitamin C Serum', 749], ['Daily Sunscreen SPF50', 499], ['Hydrating Face Mist', 399]],
        ],
    ];

    public function run(): void
    {
        $admin = User::factory()->admin()->create(['name' => 'Super Admin', 'email' => 'admin@shopsphere.test']);

        $sellers = collect([
            ['seller1@shopsphere.test', 'Maria Santos', 'Mindanao Gadget Hub'],
            ['seller2@shopsphere.test', 'Paolo Reyes', 'Urban Threads PH'],
            ['seller3@shopsphere.test', 'Ana Lim', 'Casa Lumière'],
        ])->map(fn ($s) => User::factory()->seller(SellerStatus::Approved, [
            'store_name' => $s[2],
            'store_slug' => Str::slug($s[2]),
            'description' => "Welcome to {$s[2]} — quality products, shipped fast.",
        ])->create(['email' => $s[0], 'name' => $s[1]]));

        User::factory()->seller(SellerStatus::Pending, ['store_name' => 'Fresh Start Crafts', 'store_slug' => 'fresh-start-crafts'])
            ->create(['email' => 'pending@shopsphere.test', 'name' => 'Leo Cruz']);

        // Categories + products, distributed round-robin across sellers.
        $i = 0;
        $sort = 0;
        foreach (self::CATALOG as $parentName => $children) {
            $parent = Category::create(['name' => $parentName, 'slug' => Str::slug($parentName), 'sort_order' => $sort++, 'is_active' => true]);
            foreach ($children as $childName => $products) {
                $child = Category::create([
                    'name' => $childName, 'slug' => Str::slug($parentName.' '.$childName),
                    'parent_id' => $parent->id, 'is_active' => true,
                ]);
                foreach ($products as [$name, $price]) {
                    $seller = $sellers[$i % $sellers->count()];
                    $this->product($seller, $child, $name, $price, $i);
                    $i++;
                }
            }
        }

        // Customers with an address each.
        $customers = collect([User::factory()->customer()->create(['name' => 'Juan Dela Cruz', 'email' => 'customer@shopsphere.test'])])
            ->merge(User::factory()->customer()->count(5)->create());
        $customers->each(fn ($c) => Address::factory()->for($c)->create(['recipient_name' => $c->name]));

        // Place realistic orders through the real checkout + fulfilment services.
        $this->seedOrders($customers);

        $this->command?->info('Seeded. Log in with admin@shopsphere.test / password123');
    }

    private function product(User $seller, Category $category, string $name, int $price, int $i): void
    {
        $p = new Product([
            'category_id' => $category->id,
            'name' => $name,
            'slug' => Str::slug($name),
            'sku' => strtoupper(Str::substr(Str::slug($category->name, ''), 0, 3)).'-'.str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT),
            'short_description' => "{$name} — a customer favourite in {$category->name}.",
            'description' => "<p>{$name} is built to last and backed by our seller's satisfaction guarantee.</p><ul><li>Fast nationwide shipping</li><li>Cash on Delivery available</li><li>7-day returns</li></ul>",
            'price' => $price,
            'compare_at_price' => $i % 3 === 0 ? round($price * 1.25) : null,
            'status' => 'active',
        ]);
        $p->seller_id = $seller->id;
        $p->save();

        Inventory::create(['product_id' => $p->id, 'quantity' => [40, 25, 3, 60, 12][$i % 5], 'low_stock_threshold' => 5]);

        foreach ([0, 1] as $n) {
            $p->images()->save(new ProductImage([
                // Placeholder photos; uploads from the seller dashboard replace these.
                'url' => 'https://picsum.photos/seed/shopsphere-'.$p->id.'-'.$n.'/800/800',
                'disk' => 'external',
                'alt_text' => $name,
                'sort_order' => $n,
                'is_primary' => $n === 0,
            ]));
        }
    }

    private function seedOrders($customers): void
    {
        $checkout = app(CheckoutService::class);
        $fulfil = app(SellerOrderService::class);
        $products = Product::with('inventory')->get();

        $flows = [
            [SellerOrderStatus::Confirmed, SellerOrderStatus::Packed, SellerOrderStatus::Shipped, SellerOrderStatus::Delivered],
            [SellerOrderStatus::Confirmed, SellerOrderStatus::Packed, SellerOrderStatus::Shipped],
            [SellerOrderStatus::Confirmed],
            [],
            [SellerOrderStatus::Cancelled],
        ];

        foreach (range(0, 17) as $n) {
            $customer = $customers[$n % $customers->count()];
            $cart = Cart::firstOrCreate(['user_id' => $customer->id]);

            $products->shuffle()->take(rand(1, 3))->each(function ($p) use ($cart) {
                if (($p->inventory()->value('quantity') ?? 0) > 1) {
                    $cart->items()->updateOrCreate(['product_id' => $p->id], ['quantity' => 1]);
                }
            });
            if (! $cart->items()->exists()) {
                continue;
            }

            $order = $checkout->checkout($customer, $customer->addresses()->first());

            // Spread orders over the last 30 days so dashboard charts have shape.
            $placed = now()->subDays(29 - (int) round($n * 1.6))->setTime(rand(9, 20), rand(0, 59));
            $order->forceFill(['placed_at' => $placed, 'created_at' => $placed])->save();
            $order->sellerOrders()->update(['created_at' => $placed]);
            $order->items()->update(['created_at' => $placed]);

            foreach ($order->sellerOrders()->get() as $so) {
                foreach ($flows[$n % count($flows)] as $step) {
                    $fulfil->transition($so->fresh(), $step, $step === SellerOrderStatus::Shipped
                        ? ['courier' => 'J&T Express', 'tracking_number' => 'JT'.rand(10000000, 99999999)]
                        : []);
                }
            }
        }
    }
}
