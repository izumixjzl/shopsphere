<?php

namespace App\Http\Controllers\Seller;

use App\Enums\SellerStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\SellerAppealResource;
use App\Models\SellerAppeal;
use App\Services\AuditLogger;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** Suspended sellers ask to be reinstated; available outside the approval gate. */
class AppealController extends Controller
{
    public function __construct(
        private AuditLogger $audit,
        private NotificationService $notifications,
    ) {}

    public function index(Request $request)
    {
        $profile = $request->user()->sellerProfile()->firstOrFail();

        return SellerAppealResource::collection($profile->appeals()->get());
    }

    public function store(Request $request): JsonResponse
    {
        $profile = $request->user()->sellerProfile()->firstOrFail();

        $data = $request->validate(['message' => ['required', 'string', 'min:20', 'max:3000']]);

        if ($profile->status !== SellerStatus::Suspended) {
            throw ValidationException::withMessages(['message' => 'Only suspended stores can file an appeal.']);
        }
        if ($profile->appeals()->where('status', 'open')->exists()) {
            throw ValidationException::withMessages(['message' => 'You already have an appeal under review.']);
        }

        $appeal = new SellerAppeal([
            'message' => $data['message'],
            'suspension_reason' => $profile->rejection_reason,
        ]);
        $appeal->status = 'open';
        $profile->appeals()->save($appeal);

        $this->audit->log('seller.appeal_filed', $profile, [], ['appeal_id' => $appeal->id]);
        $this->notifications->sendToAdmins('seller.appeal_filed', 'Suspension appeal filed',
            "{$profile->store_name} appealed its suspension.", ['seller_profile_id' => $profile->id, 'seller_appeal_id' => $appeal->id]);

        return (new SellerAppealResource($appeal))->response()->setStatusCode(201);
    }
}
