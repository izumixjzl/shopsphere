<?php

namespace Database\Factories;

use App\Enums\SellerStatus;
use App\Enums\UserRole;
use App\Models\SellerProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/** @extends Factory<User> */
class UserFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'phone' => '09'.fake()->numerify('#########'),
            'password' => static::$password ??= Hash::make('password123'),
            'role' => UserRole::Customer,
            'status' => 'active',
            'email_verified_at' => now(),
            'remember_token' => Str::random(10),
        ];
    }

    public function admin(): static
    {
        return $this->state(['role' => UserRole::Admin]);
    }

    public function customer(): static
    {
        return $this->state(['role' => UserRole::Customer]);
    }

    /** Seller with a store profile in the given status (approved by default). */
    public function seller(SellerStatus $status = SellerStatus::Approved, array $profile = []): static
    {
        return $this->state(['role' => UserRole::Seller])
            ->afterCreating(function (User $user) use ($status, $profile) {
                $p = SellerProfile::factory()->make($profile);
                $p->user_id = $user->id;
                $p->status = $status;
                $p->approved_at = $status === SellerStatus::Approved ? now() : null;
                $p->save();
            });
    }

    public function suspended(): static
    {
        return $this->state(['status' => 'suspended']);
    }
}
