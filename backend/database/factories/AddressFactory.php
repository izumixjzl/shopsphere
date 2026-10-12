<?php

namespace Database\Factories;

use App\Models\Address;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Address> */
class AddressFactory extends Factory
{
    public function definition(): array
    {
        return [
            'label' => 'Home',
            'recipient_name' => fake()->name(),
            'phone' => '09'.fake()->numerify('#########'),
            'line1' => fake()->streetAddress(),
            'barangay' => 'Poblacion',
            'city' => fake()->randomElement(['Davao City', 'Cebu City', 'Quezon City', 'Butuan City']),
            'province' => fake()->randomElement(['Davao del Sur', 'Cebu', 'Metro Manila', 'Agusan del Norte']),
            'postal_code' => fake()->numerify('####'),
            'country' => 'PH',
            'is_default' => true,
        ];
    }
}
