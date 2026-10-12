<?php

namespace App\Mail;

use App\Models\Notification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** Email copy of an in-app notification. Queued so sending never slows a request. */
class NotificationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public Notification $notification) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->notification->title);
    }

    public function content(): Content
    {
        $path = $this->notification->data['url'] ?? null;

        return new Content(markdown: 'mail.notification', with: [
            'title' => $this->notification->title,
            'body' => $this->notification->message,
            'url' => rtrim(config('app.url'), '/').($path ?? '/'),
            'hasLink' => (bool) $path,
        ]);
    }
}
