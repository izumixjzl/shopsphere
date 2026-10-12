<x-mail::message>
# {{ $title }}

{{ $body }}

<x-mail::button :url="$url">
{{ $hasLink ? 'View details' : 'Open ShopSphere' }}
</x-mail::button>

You're receiving this because you have a {{ config('app.name') }} account.
</x-mail::message>
