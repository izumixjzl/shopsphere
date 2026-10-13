<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Payments\GatewayRegistry;
use App\Payments\SandboxGateway;
use App\Payments\WebhookEvent;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Stands in for a provider's hosted checkout page while the sandbox gateway is enabled.
 * "Paying" here does not touch the order directly: it produces a signed webhook and feeds it
 * through the same verification + processing path a real provider's webhook takes.
 */
class SandboxPaymentController extends Controller
{
    public function show(Request $request, string $reference, GatewayRegistry $gateways): JsonResponse
    {
        $payment = $this->find($request, $reference, $gateways);

        return response()->json(['data' => [
            'reference' => $payment->transaction_reference,
            'amount' => $payment->amount,
            'status' => $payment->status,
            'expires_at' => $payment->expires_at?->toIso8601String(),
            'order' => ['id' => $payment->order->id, 'order_number' => $payment->order->order_number],
        ]]);
    }

    public function complete(Request $request, string $reference, GatewayRegistry $gateways, PaymentService $payments): JsonResponse
    {
        $data = $request->validate(['outcome' => ['required', Rule::in([WebhookEvent::PAID, WebhookEvent::FAILED])]]);
        $payment = $this->find($request, $reference, $gateways);

        /** @var SandboxGateway $gateway */
        $gateway = $gateways->get('sandbox');
        [$body, $headers] = $gateway->simulateWebhook($payment, $data['outcome']);
        $result = $payments->handleWebhook('sandbox', $gateway->parseWebhook($body, $headers));

        return response()->json(['data' => ['result' => $result, 'status' => $payment->fresh()->status, 'order_id' => $payment->order_id]]);
    }

    private function find(Request $request, string $reference, GatewayRegistry $gateways): Payment
    {
        abort_unless($gateways->isEnabled('sandbox'), 404);

        $payment = Payment::with('order')->where('provider', 'sandbox')->where('transaction_reference', $reference)->first();
        abort_unless($payment && $payment->order->user_id === $request->user()->id, 404);

        return $payment;
    }
}
