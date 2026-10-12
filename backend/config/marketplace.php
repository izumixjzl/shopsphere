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

    // Also email every in-app notification (queued; needs a running queue worker).
    'email_notifications' => (bool) env('MARKETPLACE_EMAIL_NOTIFICATIONS', true),
];
