<?php

namespace Database\Factories;

use App\Models\SellerProfile;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<SellerProfile> */
class SellerProfileFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->company();

        return [
            'store_name' => $name,
            'store_slug' => Str::slug($name).'-'.Str::lower(Str::random(4)),
            'description' => fake()->sentence(14),
            'contact_email' => fake()->companyEmail(),
            'contact_phone' => '09'.fake()->numerify('#########'),
            'business_address' => fake()->city().', Philippines',
        ];
    }
}
