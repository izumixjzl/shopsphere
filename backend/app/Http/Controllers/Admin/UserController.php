<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function __construct(private AuditLogger $audit) {}

    public function index(Request $request)
    {
        $filters = $request->validate([
            'role' => ['nullable', Rule::enum(UserRole::class)],
            'status' => ['nullable', Rule::in(['active', 'suspended'])],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $users = User::query()
            ->when($filters['role'] ?? null, fn ($q, $r) => $q->where('role', $r))
            ->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($filters['q'] ?? null, fn ($q, $t) => $q->where(fn ($w) => $w
                ->where('name', 'like', "%{$t}%")->orWhere('email', 'like', "%{$t}%")))
            ->with('sellerProfile')
            ->latest()->paginate(20)->withQueryString();

        return UserResource::collection($users);
    }

    public function updateStatus(Request $request, User $user): UserResource
    {
        $data = $request->validate(['status' => ['required', Rule::in(['active', 'suspended'])]]);

        if ($user->id === $request->user()->id) {
            throw ValidationException::withMessages(['status' => 'You cannot change your own status.']);
        }

        $old = ['status' => $user->status];
        $user->forceFill(['status' => $data['status']])->save();

        if ($data['status'] === 'suspended') {
            $user->tokens()->delete(); // sign them out everywhere
        }

        $this->audit->log('user.'.$data['status'], $user, $old, $data);

        return new UserResource($user->load('sellerProfile'));
    }
}
