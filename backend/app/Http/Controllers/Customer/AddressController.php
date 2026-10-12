<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Address;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AddressController extends Controller
{
    private const RULES = [
        'label' => ['nullable', 'string', 'max:40'],
        'recipient_name' => ['required', 'string', 'max:120'],
        'phone' => ['required', 'string', 'max:30'],
        'line1' => ['required', 'string', 'max:255'],
        'line2' => ['nullable', 'string', 'max:255'],
        'barangay' => ['nullable', 'string', 'max:100'],
        'city' => ['required', 'string', 'max:100'],
        'province' => ['required', 'string', 'max:100'],
        'postal_code' => ['required', 'string', 'max:12'],
        'country' => ['nullable', 'string', 'size:2'],
        'is_default' => ['nullable', 'boolean'],
    ];

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->addresses()->orderByDesc('is_default')->latest()->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(self::RULES);
        $user = $request->user();

        $address = DB::transaction(function () use ($user, $data) {
            $isFirst = ! $user->addresses()->exists();
            $makeDefault = $isFirst || ! empty($data['is_default']);
            if ($makeDefault) {
                $user->addresses()->update(['is_default' => false]);
            }

            return $user->addresses()->create([...$data, 'is_default' => $makeDefault, 'country' => $data['country'] ?? 'PH']);
        });

        return response()->json(['data' => $address], 201);
    }

    public function update(Request $request, Address $address): JsonResponse
    {
        $this->authorize('update', $address);
        $data = $request->validate(self::RULES);

        DB::transaction(function () use ($request, $address, $data) {
            if (! empty($data['is_default'])) {
                $request->user()->addresses()->whereKeyNot($address->id)->update(['is_default' => false]);
            }
            $address->update($data);
        });

        return response()->json(['data' => $address->fresh()]);
    }

    public function destroy(Request $request, Address $address): JsonResponse
    {
        $this->authorize('delete', $address);

        DB::transaction(function () use ($request, $address) {
            $wasDefault = $address->is_default;
            $address->delete();
            if ($wasDefault) {
                $request->user()->addresses()->latest()->first()?->update(['is_default' => true]);
            }
        });

        return response()->json(['message' => 'Address deleted.']);
    }
}
