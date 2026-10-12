<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Events\NotificationCreated;
use App\Mail\NotificationMail;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Notifications are stored in the `notifications` table (the source of truth),
 * then pushed live over WebSockets (Reverb) and queued as an email.
 * Callers only ever call send() / sendToAdmins().
 */
class NotificationService
{
    public function send(User|int $user, string $type, string $title, string $message, array $data = []): Notification
    {
        $user = $user instanceof User ? $user : User::findOrFail($user);

        if ($url = $this->linkFor($user->role, $type, $data)) {
            $data['url'] = $url;
        }

        $notification = Notification::create([
            'user_id' => $user->id,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'data' => $data ?: null,
        ]);

        // Only deliver once the surrounding transaction (if any) has committed.
        DB::afterCommit(fn () => $this->deliver($user, $notification));

        return $notification;
    }

    public function sendToAdmins(string $type, string $title, string $message, array $data = []): void
    {
        User::query()->where('role', UserRole::Admin)->where('status', 'active')->get()
            ->each(fn (User $admin) => $this->send($admin, $type, $title, $message, $data));
    }

    /** Delivery is best-effort: a WebSocket or mail outage must never break the action that triggered it. */
    private function deliver(User $user, Notification $notification): void
    {
        try {
            broadcast(new NotificationCreated($notification));
        } catch (Throwable $e) {
            report($e);
        }

        if (config('marketplace.email_notifications') && $user->isActive()) {
            try {
                Mail::to($user)->queue(new NotificationMail($notification));
            } catch (Throwable $e) {
                report($e);
            }
        }
    }

    /** Frontend path the notification opens, based on who receives it. */
    public function linkFor(UserRole $role, string $type, array $data): ?string
    {
        $group = strtok($type, '.');

        return match ($role) {
            UserRole::Customer => match (true) {
                $group === 'refund' => '/account/returns',
                isset($data['order_id']) => "/account/orders/{$data['order_id']}",
                $group === 'order' => '/account/orders',
                default => null,
            },
            UserRole::Seller => match (true) {
                $group === 'refund' => '/seller/returns',
                isset($data['seller_order_id']) => "/seller/orders/{$data['seller_order_id']}",
                isset($data['product_id']) => "/seller/products/{$data['product_id']}",
                $group === 'seller_order' => '/seller/orders',
                $group === 'payout' => '/seller/finance',
                $group === 'seller' => '/seller/store',
                default => null,
            },
            UserRole::Admin => match ($group) {
                'seller' => '/admin/sellers',
                'product_report' => '/admin/reports',
                default => null,
            },
        };
    }
}
