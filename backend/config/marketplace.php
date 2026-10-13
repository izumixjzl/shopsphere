<?php

return [
    // Percentage the marketplace keeps from each seller order (overridable per seller).
    'default_commission_rate' => (float) env('MARKETPLACE_DEFAULT_COMMISSION_RATE', 10.00),

    // Default quantity at or below which a product is flagged as low stock.
    'low_stock_threshold' => (int) env('MARKETPLACE_LOW_STOCK_THRESHOLD', 5),

    // Flat shipping fee charged once per seller in a checkout.
    'shipping_fee_per_seller' => (float) env('MARKETPLACE_SHIPPING_FEE_PER_SELLER', 50.00),

    'currency' => env('MARKETPLACE_CURRENCY', 'PHP'),

    // Max images per product and per-file size limit (KB).
    'max_product_images' => 6,
    'max_image_kb' => 4096,

    // Proof photos/videos on return requests. Private disk: 'local' here, a private S3 bucket in production.
    'evidence_disk' => env('MARKETPLACE_EVIDENCE_DISK', 'local'),
    'max_evidence_files' => 5,
    'max_evidence_kb' => 20480,
    // Reasons where the customer must attach at least one photo or video.
    'evidence_required_reasons' => ['Item arrived damaged', 'Wrong item received'],

    // Couriers sellers pick from when shipping: code => display name. "other" (free text) is always allowed.
    // `aliases` map common spellings typed before the dropdown existed (and by API clients) to a code.
    'couriers' => [
        'jnt' => ['name' => 'J&T Express', 'aliases' => ['j&t', 'jnt', 'j and t', 'jt express']],
        'lbc' => ['name' => 'LBC Express', 'aliases' => ['lbc']],
        'ninjavan' => ['name' => 'Ninja Van', 'aliases' => ['ninjavan', 'ninja']],
        'flash' => ['name' => 'Flash Express', 'aliases' => ['flash']],
        '2go' => ['name' => '2GO Express', 'aliases' => ['2go']],
        'gogo' => ['name' => 'GoGo Xpress', 'aliases' => ['gogo', 'gogo express']],
        'grab' => ['name' => 'Grab Express', 'aliases' => ['grab', 'grabexpress']],
        'lalamove' => ['name' => 'Lalamove', 'aliases' => []],
    ],

    // Hide a listing for admin review once this many different customers have open reports on it (0 = off).
    'auto_flag_report_threshold' => (int) env('MARKETPLACE_AUTO_FLAG_REPORT_THRESHOLD', 3),

    // Also email every in-app notification (queued; needs a running queue worker).
    'email_notifications' => (bool) env('MARKETPLACE_EMAIL_NOTIFICATIONS', true),
];
