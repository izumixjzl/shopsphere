<?php

namespace App\Http\Controllers\Auth;

use App\Enums\SellerStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\SellerProfile;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private AuditLogger $audit,
        private NotificationService $notifications,
    ) {}

    /** Public sign-up for customers and sellers. Admins are created by seeder only. */
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email:rfc', 'max:255', Rule::unique('users', 'email')],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
            'role' => ['required', Rule::in([UserRole::Customer->value, UserRole::Seller->value])],
            'store_name' => ['required_if:role,seller', 'nullable', 'string', 'max:120'],
            'store_description' => ['nullable', 'string', 'max:2000'],
            'business_address' => ['nullable', 'string', 'max:255'],
        ]);

        $user = DB::transaction(function () use ($data) {
            $user = new User([
                'name' => $data['name'],
                'email' => strtolower($data['email']),
                'phone' => $data['phone'] ?? null,
                'password' => $data['password'], // hashed by the model cast
            ]);
            $user->role = UserRole::from($data['role']);
            $user->status = 'active';
            $user->save();

            if ($user->isSeller()) {
                $profile = new SellerProfile([
                    'store_name' => $data['store_name'],
                    'store_slug' => $this->uniqueStoreSlug($data['store_name']),
                    'description' => $data['store_description'] ?? null,
                    'business_address' => $data['business_address'] ?? null,
                    'contact_email' => $user->email,
                    'contact_phone' => $user->phone,
                ]);
                $profile->status = SellerStatus::Pending;
                $user->sellerProfile()->save($profile);
            }

            return $user;
        });

        $this->audit->log('user.registered', $user, [], ['role' => $user->role->value]);

        if ($user->isSeller()) {
            $this->notifications->sendToAdmins(
                'seller.application', 'New seller application',
                "{$data['store_name']} applied to sell on ShopSphere.",
                ['user_id' => $user->id],
            );
        }

        return $this->tokenResponse($user, 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', strtolower($data['email']))->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'These credentials do not match our records.']);
        }
        if (! $user->isActive()) {
            throw ValidationException::withMessages(['email' => 'This account has been suspended.']);
        }

        $user->forceFill(['last_login_at' => now()])->save();
        $this->audit->log('user.login', $user);

        return $this->tokenResponse($user);
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user()->load('sellerProfile'));
    }

    public function updateProfile(Request $request): UserResource
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:30'],
            'avatar_url' => ['nullable', 'url', 'max:255'],
        ]);
        $user->update($data);

        return new UserResource($user->load('sellerProfile'));
    }

    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => ['required', 'current_password:sanctum'],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ]);

        $user = $request->user();
        $user->update(['password' => $request->input('password')]);

        // Sign out other devices.
        $user->tokens()->where('id', '!=', $user->currentAccessToken()->id)->delete();
        $this->audit->log('user.password_changed', $user);

        return response()->json(['message' => 'Password updated.']);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    private function tokenResponse(User $user, int $status = 200): JsonResponse
    {
        $token = $user->createToken('spa', [$user->role->value], now()->addDays(14))->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new UserResource($user->load('sellerProfile')),
        ], $status);
    }

    private function uniqueStoreSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'store';
        $slug = $base;
        $i = 2;
        while (SellerProfile::where('store_slug', $slug)->exists()) {
            $slug = "{$base}-{$i}";
            $i++;
        }

        return $slug;
    }
}
