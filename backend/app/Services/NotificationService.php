<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;

/**
 * In-app notifications stored in the `notifications` table.
 * Email/push channels can be added here later without touching callers.
 */
class NotificationService
{
    public function send(User|int $user, string $type, string $title, string $message, array $data = []): Notification
    {
        return Notification::create([
            'user_id' => $user instanceof User ? $user->id : $user,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'data' => $data ?: null,
        ]);
    }

    public function sendToAdmins(string $type, string $title, string $message, array $data = []): void
    {
        User::query()->where('role', 'admin')->where('status', 'active')->pluck('id')
            ->each(fn ($id) => $this->send($id, $type, $title, $message, $data));
    }
}
