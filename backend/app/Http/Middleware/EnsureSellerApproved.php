<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Sellers can log in and edit their store profile while pending, but cannot sell until approved. */
class EnsureSellerApproved
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user?->isApprovedSeller()) {
            return response()->json([
                'message' => 'Your seller account is not approved yet.',
                'seller_status' => $user?->sellerProfile?->status?->value,
            ], 403);
        }

        return $next($request);
    }
}
