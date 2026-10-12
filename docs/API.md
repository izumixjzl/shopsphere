# REST API reference

Base URL: `http://localhost:8000/api`. Send `Accept: application/json`. Authenticated routes need `Authorization: Bearer <token>` (Laravel Sanctum personal access token, 14-day expiry). Validation errors return `422` with `{ message, errors: { field: [..] } }`.

## Public

| Method | Path | Notes |
|---|---|---|
| GET | `/categories` | Active category tree |
| GET | `/products` | `q, category, store, min_price, max_price, min_rating, in_stock, sort (newest·popular·price_asc·price_desc·rating), per_page, page` |
| GET | `/products/{slug}` | Product, rating breakdown, related products |
| GET | `/products/{slug}/reviews` | Paginated verified reviews |
| GET | `/stores/{slug}` | Storefront profile + stats |

## Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | `role` = customer or seller (seller needs `store_name`). Admins can't self-register. Rate-limited. |
| POST | `/auth/login` | Returns `{ token, user }`. Rate-limited. |
| GET / PATCH | `/auth/me` | Profile |
| PUT | `/auth/password` | Signs out other devices |
| POST | `/auth/logout` | Revokes the current token |
| GET | `/notifications` · POST `/notifications/read-all` · POST `/notifications/{id}/read` | Any role |

## Customer (`role:customer`)

| Method | Path | Notes |
|---|---|---|
| GET | `/cart` | Grouped by seller, with availability flags and totals |
| POST | `/cart/items` | `product_id, quantity` (stock-checked) |
| PATCH / DELETE | `/cart/items/{id}` | |
| GET POST PUT DELETE | `/addresses[/{id}]` | |
| POST | `/orders` | **Checkout**: `address_id, payment_method=cod, notes?` → parent order + seller orders |
| GET | `/orders`, `/orders/{id}` | With shipments and tracking |
| POST | `/orders/{id}/cancel` | Only while every seller order is pending |
| GET | `/wishlist`, `/wishlist/ids` · POST `/wishlist/{productId}` (toggle) | |
| POST | `/order-items/{id}/review` | After delivery, once |
| GET | `/refunds` · POST `/order-items/{id}/refunds` | Return/refund/dispute within 7 days of delivery |

## Seller (`role:seller`; most need `seller.approved`)

| Method | Path | Notes |
|---|---|---|
| GET / POST | `/seller/store` | Profile (multipart for logo/banner) — allowed while pending |
| POST | `/seller/store/verifications` | Upload a document — allowed while pending |
| GET | `/seller/dashboard?from&to` | KPIs, sales series, status breakdown, best sellers, low stock |
| GET | `/seller/finance` | Commission ledger + payout history |
| GET | `/seller/reports/sales?format=csv|pdf&from&to` | Download |
| GET / POST | `/seller/products` | List (filters `q, status, stock=low|out`) / create (multipart, `images[]`) |
| GET / POST / DELETE | `/seller/products/{id}` | Show / update (multipart) / soft delete |
| PATCH | `/seller/products/{id}/stock` | `stock, low_stock_threshold` |
| POST | `/seller/products/{id}/images` · PATCH `…/images/{imageId}/primary` · DELETE `…/images/{imageId}` | |
| GET | `/seller/orders`, `/seller/orders/{id}` | Own seller orders only (policy-checked) |
| PATCH | `/seller/orders/{id}/status` | `status` + `courier, tracking_number` when shipping, `reason` when cancelling. Transitions: pending → confirmed → packed → shipped → delivered (→ returned); cancel allowed until shipped. |

## Admin (`role:admin`)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/dashboard?from&to` · `/admin/reports/sales?format&from&to&seller_id` · `/admin/audit-logs` | |
| GET | `/admin/sellers?status&q`, `/admin/sellers/{id}` | |
| POST | `/admin/sellers/{id}/approve` · `/reject` (`reason`) · `/suspend` (`reason`) | |
| PATCH | `/admin/sellers/{id}/commission` | `commission_rate` 0–50 or null for default |
| PATCH | `/admin/verifications/{id}` · GET `/admin/verifications/{id}/download` | |
| GET | `/admin/users` · PATCH `/admin/users/{id}/status` | Suspending revokes all tokens |
| GET POST PUT DELETE | `/admin/categories[/{id}]` | |
| GET | `/admin/products` · PATCH `/admin/products/{id}/moderation` | approved / flagged / removed |
| GET | `/admin/orders`, `/admin/orders/{id}` · PATCH `/admin/seller-orders/{id}/status` | Override with the same transition rules |
| GET | `/admin/refunds` · POST `/admin/refunds/{id}/decide` · POST `/admin/refunds/{id}/refunded` | |
| GET | `/admin/payouts` · POST `/admin/payouts` (`seller_id`) · POST `/admin/payouts/{id}/paid` | |
