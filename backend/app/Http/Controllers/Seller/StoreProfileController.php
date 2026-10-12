<?php

namespace App\Http\Controllers\Seller;

use App\Enums\SellerStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\SellerProfileResource;
use App\Models\SellerVerification;
use App\Services\AuditLogger;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/** Sellers manage their storefront; available even while approval is pending. */
class StoreProfileController extends Controller
{
    public function __construct(
        private AuditLogger $audit,
        private NotificationService $notifications,
    ) {}

    public function show(Request $request): SellerProfileResource
    {
        return new SellerProfileResource($request->user()->sellerProfile()->with('verifications')->firstOrFail());
    }

    public function update(Request $request): SellerProfileResource
    {
        $profile = $request->user()->sellerProfile()->firstOrFail();

        $data = $request->validate([
            'store_name' => ['sometimes', 'required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:2000'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'contact_phone' => ['nullable', 'string', 'max:30'],
            'business_address' => ['nullable', 'string', 'max:255'],
            'logo' => ['nullable', 'image', 'max:2048'],
            'banner' => ['nullable', 'image', 'max:4096'],
        ]);

        $disk = config('filesystems.default');
        foreach (['logo', 'banner'] as $field) {
            if ($request->hasFile($field)) {
                $path = $request->file($field)->store("stores/{$profile->id}", $disk);
                $data["{$field}_url"] = Storage::disk($disk)->url($path);
            }
            unset($data[$field]);
        }

        $old = $profile->only(array_keys($data));
        $profile->update($data);
        $this->audit->log('seller.profile_updated', $profile, $old, $data);

        return new SellerProfileResource($profile->load('verifications'));
    }

    /** Upload a verification document (business permit, DTI, valid ID…). */
    public function uploadVerification(Request $request): JsonResponse
    {
        $profile = $request->user()->sellerProfile()->firstOrFail();

        $data = $request->validate([
            'document_type' => ['required', Rule::in(['business_permit', 'dti', 'sec', 'bir', 'valid_id'])],
            'document' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        // Verification documents are private; never on the public disk.
        $path = $request->file('document')->store("verifications/{$profile->id}", 'local');

        $verification = new SellerVerification([
            'document_type' => $data['document_type'],
            'document_url' => $path,
            'notes' => $data['notes'] ?? null,
        ]);
        $verification->status = 'pending';
        $profile->verifications()->save($verification);

        // Re-apply after rejection.
        if ($profile->status === SellerStatus::Rejected) {
            $profile->forceFill(['status' => SellerStatus::Pending, 'rejection_reason' => null])->save();
        }

        $this->notifications->sendToAdmins('seller.verification_uploaded', 'Verification document uploaded',
            "{$profile->store_name} uploaded a {$data['document_type']} document.", ['seller_profile_id' => $profile->id]);

        return response()->json(['data' => $verification], 201);
    }
}
