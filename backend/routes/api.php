<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\CatalogController;
use App\Http\Controllers\CourierController;
use App\Http\Controllers\Customer;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PaymentWebhookController;
use App\Http\Controllers\Seller;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| ShopSphere REST API  (prefix: /api)
|--------------------------------------------------------------------------
| Public catalog → auth → customer → seller → admin.
| Authorization: Sanctum bearer tokens + `role:` middleware + Policies.
*/

// ---- Public storefront ------------------------------------------------------
Route::name('catalog.')->group(function () {
    Route::get('categories', [CatalogController::class, 'categories'])->name('categories');
    Route::get('products', [CatalogController::class, 'products'])->name('products');
    Route::get('products/{slug}', [CatalogController::class, 'product'])->name('product.show');
    Route::get('products/{slug}/reviews', [CatalogController::class, 'productReviews'])->name('product.reviews');
    Route::get('stores/{slug}', [CatalogController::class, 'store'])->name('store.show');
    Route::get('stores/{slug}/reviews', [CatalogController::class, 'storeReviews'])->name('store.reviews');
});

// ---- Payment provider webhooks (no session; verified by signature) ---------
Route::post('webhooks/payments/{provider}', PaymentWebhookController::class)
    ->middleware('throttle:120,1')->name('webhooks.payments');

// ---- Authentication ---------------------------------------------------------
Route::prefix('auth')->name('auth.')->group(function () {
    Route::middleware('throttle:auth')->group(function () {
        Route::post('register', [AuthController::class, 'register'])->name('register');
        Route::post('login', [AuthController::class, 'login'])->name('login');
    });

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('me', [AuthController::class, 'me'])->name('me');
        Route::patch('me', [AuthController::class, 'updateProfile'])->name('me.update');
        Route::put('password', [AuthController::class, 'changePassword'])->name('password');
        Route::post('logout', [AuthController::class, 'logout'])->name('logout');
    });
});

Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {

    // ---- Any signed-in user ---------------------------------------------------
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::post('notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::get('couriers', CourierController::class)->middleware('role:seller,admin')->name('couriers');

    // ---- Customer ------------------------------------------------------------
    Route::middleware('role:customer')->name('customer.')->group(function () {
        Route::get('cart', [Customer\CartController::class, 'show'])->name('cart');
        Route::post('cart/items', [Customer\CartController::class, 'add'])->name('cart.add');
        Route::patch('cart/items/{item}', [Customer\CartController::class, 'update'])->name('cart.update');
        Route::delete('cart/items/{item}', [Customer\CartController::class, 'remove'])->name('cart.remove');
        Route::delete('cart', [Customer\CartController::class, 'clear'])->name('cart.clear');

        Route::apiResource('addresses', Customer\AddressController::class)->except('show');

        Route::get('checkout/payment-methods', [Customer\OrderController::class, 'paymentMethods'])->name('checkout.payment-methods');
        Route::get('orders', [Customer\OrderController::class, 'index'])->name('orders.index');
        Route::post('orders', [Customer\OrderController::class, 'store'])->name('orders.store'); // checkout (Idempotency-Key header)
        Route::post('orders/{order}/pay', [Customer\OrderController::class, 'pay'])->name('orders.pay');

        // Stand-in for a provider's hosted checkout page; 404s unless the sandbox gateway is enabled.
        Route::get('sandbox/payments/{reference}', [Customer\SandboxPaymentController::class, 'show'])->name('sandbox.show');
        Route::post('sandbox/payments/{reference}/complete', [Customer\SandboxPaymentController::class, 'complete'])->name('sandbox.complete');
        Route::get('orders/{order}', [Customer\OrderController::class, 'show'])->name('orders.show');
        Route::post('orders/{order}/cancel', [Customer\OrderController::class, 'cancel'])->name('orders.cancel');

        Route::get('wishlist', [Customer\WishlistController::class, 'index'])->name('wishlist');
        Route::get('wishlist/ids', [Customer\WishlistController::class, 'ids'])->name('wishlist.ids');
        Route::post('wishlist/{product}', [Customer\WishlistController::class, 'toggle'])->name('wishlist.toggle');

        Route::post('order-items/{orderItem}/review', [Customer\ReviewController::class, 'store'])->name('reviews.store');

        // Requests are final once filed: no update/delete routes, so details and proof can't be changed.
        Route::get('refunds', [Customer\RefundController::class, 'index'])->name('refunds.index');
        Route::post('order-items/{orderItem}/refunds', [Customer\RefundController::class, 'store'])->name('refunds.store');

        Route::post('products/{product}/reports', [Customer\ProductReportController::class, 'store'])->name('product-reports.store');
    });

    // ---- Seller --------------------------------------------------------------
    Route::prefix('seller')->name('seller.')->middleware('role:seller')->group(function () {
        // Allowed while approval is pending, so sellers can complete their profile.
        Route::get('store', [Seller\StoreProfileController::class, 'show'])->name('store.show');
        Route::post('store', [Seller\StoreProfileController::class, 'update'])->name('store.update'); // multipart
        Route::post('store/verifications', [Seller\StoreProfileController::class, 'uploadVerification'])->name('store.verifications');
        // Suspended stores can still appeal.
        Route::get('appeals', [Seller\AppealController::class, 'index'])->name('appeals.index');
        Route::post('appeals', [Seller\AppealController::class, 'store'])->name('appeals.store');

        Route::middleware('seller.approved')->group(function () {
            Route::get('dashboard', [Seller\DashboardController::class, 'index'])->name('dashboard');
            Route::get('finance', [Seller\DashboardController::class, 'finance'])->name('finance');
            Route::get('reports/sales', [Seller\DashboardController::class, 'report'])->name('reports.sales');

            Route::get('products', [Seller\ProductController::class, 'index'])->name('products.index');
            Route::post('products', [Seller\ProductController::class, 'store'])->name('products.store');
            Route::get('products/{product}', [Seller\ProductController::class, 'show'])->name('products.show');
            Route::post('products/{product}', [Seller\ProductController::class, 'update'])->name('products.update'); // multipart-friendly
            Route::delete('products/{product}', [Seller\ProductController::class, 'destroy'])->name('products.destroy');
            Route::patch('products/{product}/stock', [Seller\ProductController::class, 'updateStock'])->name('products.stock');
            Route::post('products/{product}/images', [Seller\ProductController::class, 'uploadImages'])->name('products.images.store');
            Route::patch('products/{product}/images/{image}/primary', [Seller\ProductController::class, 'setPrimaryImage'])->name('products.images.primary');
            Route::delete('products/{product}/images/{image}', [Seller\ProductController::class, 'deleteImage'])->name('products.images.destroy');

            Route::get('orders', [Seller\OrderController::class, 'index'])->name('orders.index');
            Route::get('orders/{sellerOrder}', [Seller\OrderController::class, 'show'])->name('orders.show');
            Route::patch('orders/{sellerOrder}/status', [Seller\OrderController::class, 'updateStatus'])->name('orders.status');

            // The seller has the final say on returns / disputes for their orders.
            Route::get('refunds', [Seller\RefundController::class, 'index'])->name('refunds.index');
            Route::post('refunds/{refund}/decide', [Seller\RefundController::class, 'decide'])->name('refunds.decide');
            Route::post('refunds/{refund}/refunded', [Seller\RefundController::class, 'markRefunded'])->name('refunds.refunded');
        });
    });

    // ---- Super admin ---------------------------------------------------------
    Route::prefix('admin')->name('admin.')->middleware('role:admin')->group(function () {
        Route::get('dashboard', [Admin\DashboardController::class, 'index'])->name('dashboard');
        Route::get('reports/sales', [Admin\DashboardController::class, 'report'])->name('reports.sales');
        Route::get('audit-logs', [Admin\DashboardController::class, 'auditLogs'])->name('audit-logs');

        Route::get('sellers', [Admin\SellerController::class, 'index'])->name('sellers.index');
        Route::get('sellers/{seller}', [Admin\SellerController::class, 'show'])->name('sellers.show');
        Route::get('sellers/{seller}/trust', [Admin\SellerController::class, 'trust'])->name('sellers.trust');
        Route::post('sellers/{seller}/approve', [Admin\SellerController::class, 'approve'])->name('sellers.approve');
        Route::post('sellers/{seller}/reject', [Admin\SellerController::class, 'reject'])->name('sellers.reject');
        Route::post('sellers/{seller}/suspend', [Admin\SellerController::class, 'suspend'])->name('sellers.suspend');
        Route::patch('sellers/{seller}/commission', [Admin\SellerController::class, 'updateCommission'])->name('sellers.commission');
        Route::patch('verifications/{verification}', [Admin\SellerController::class, 'reviewVerification'])->name('verifications.review');
        Route::get('verifications/{verification}/download', [Admin\SellerController::class, 'downloadVerification'])->name('verifications.download');
        Route::post('seller-appeals/{appeal}/decide', [Admin\SellerAppealController::class, 'decide'])->name('seller-appeals.decide');

        Route::get('users', [Admin\UserController::class, 'index'])->name('users.index');
        Route::patch('users/{user}/status', [Admin\UserController::class, 'updateStatus'])->name('users.status');

        Route::apiResource('categories', Admin\CategoryController::class)->except('show');

        Route::get('products', [Admin\ProductModerationController::class, 'index'])->name('products.index');
        Route::patch('products/{product}/moderation', [Admin\ProductModerationController::class, 'moderate'])->name('products.moderate');

        Route::get('reports', [Admin\ProductReportController::class, 'index'])->name('reports.index');
        Route::post('reports/{report}/resolve', [Admin\ProductReportController::class, 'resolve'])->name('reports.resolve');

        Route::get('orders', [Admin\OrderController::class, 'index'])->name('orders.index');
        Route::get('orders/{order}', [Admin\OrderController::class, 'show'])->name('orders.show');
        Route::patch('seller-orders/{sellerOrder}/status', [Admin\OrderController::class, 'updateSellerOrder'])->name('seller-orders.status');


        Route::get('payouts', [Admin\PayoutController::class, 'index'])->name('payouts.index');
        Route::get('payouts/sellers', [Admin\PayoutController::class, 'sellers'])->name('payouts.sellers');
        Route::post('payouts', [Admin\PayoutController::class, 'store'])->name('payouts.store');
        Route::post('payouts/{payout}/paid', [Admin\PayoutController::class, 'markPaid'])->name('payouts.paid');
    });
});
