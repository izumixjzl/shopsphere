<?php

namespace App\Http\Controllers;

use App\Payments\GatewayRegistry;
use App\Payments\InvalidWebhookSignature;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Public endpoint providers POST to. Authenticity comes from the signature, not a session.
 * Replies 2xx for anything we've safely recorded (including duplicates) so the provider stops
 * retrying; 400 for bad signatures; 5xx only if processing crashed, so the provider retries.
 */
class PaymentWebhookController extends Controller
{
    public function __invoke(Request $request, string $provider, GatewayRegistry $gateways, PaymentService $payments): JsonResponse
    {
        try {
            $gateway = $gateways->get($provider);
        } catch (ValidationException) {
            return response()->json(['message' => 'Unknown payment provider.'], 404);
        }

        $headers = collect($request->headers->all())->map(fn ($v) => $v[0] ?? '')->all();

        try {
            $event = $gateway->parseWebhook($request->getContent(), $headers);
        } catch (InvalidWebhookSignature $e) {
            report($e);

            return response()->json(['message' => 'Invalid signature.'], 400);
        }

        return response()->json(['status' => $payments->handleWebhook($provider, $event)]);
    }
}
