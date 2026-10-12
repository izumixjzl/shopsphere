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
];
