# REST API reference

Base URL: `http://localhost:8000/api`. Send `Accept: application/json`. Authenticated routes need `Authorization: Bearer <token>` (Laravel Sanctum personal access token, 14-day expiry). Validation errors return `422` with `{ message, errors: { field: [..] } }`.

## Public

| Method | Path | Notes |
|---|---|---|
| GET | `/categories` | Active category tree |
| GET | `/products` | `q, category, store, min_price, max_price, min_rating, in_stock, sort (newest·popular·price_asc·price_desc·rating), per_page, page` |
| GET | `/products/{slug}` | Product, rating breakdown, related products |
| GET | `/products/{slug}/reviews` | Paginated verified reviews |
| GET | `/stores/{slug}` | Storefront profile + stats (seller rating from verified purchases) |
| GET | `/stores/{slug}/reviews` | Paginated verified reviews across all of the store's products |

## Payment webhooks

| Method | Path | Notes |
|---|---|---|
| POST | `/webhooks/payments/{provider}` | No auth; verified by signature (sandbox: `X-Sandbox-Signature: t=<unix>,v1=<hmac_sha256(secret, "t.body")>`, 5-minute window). Each event id is processed once (`webhook_events`); amount and currency must match; a captured payment is never undone by a later "failed" event; money arriving for a cancelled order is recorded and flagged for refund. Replies 400 for bad signatures, 2xx once recorded. |

## Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | `role` = customer or seller (seller needs `store_name`). Admins can't self-register. Rate-limited. |
| POST | `/auth/login` | Returns `{ token, user }`. Rate-limited. |
| GET / PATCH | `/auth/me` | Profile |
| PUT | `/auth/password` | Signs out other devices |
| POST | `/auth/logout` | Revokes the current token |
| GET | `/notifications` · POST `/notifications/read-all` · POST `/notifications/{id}/read` | Any role |
| GET | `/couriers` | Seller/admin: courier list (`code, name`) plus the seller's `last` used courier |

## Customer (`role:customer`)

| Method | Path | Notes |
|---|---|---|
| GET | `/cart` | Grouped by seller, with availability flags and totals |
| POST | `/cart/items` | `product_id, quantity` (stock-checked) |
| PATCH / DELETE | `/cart/items/{id}` | |
| GET POST PUT DELETE | `/addresses[/{id}]` | |
| GET | `/checkout/payment-methods` | `cod` plus enabled gateways (`sandbox` outside production) |
| POST | `/orders` | **Checkout**: `address_id, payment_method, notes?, expected_total?` + `Idempotency-Key` header (8–64 chars, one per attempt). Prices, stock, shipping and commission are computed server-side; `expected_total` mismatch → 422 and nothing is charged. Same key again → the original order with `200` (first time `201`). Online methods return a pending payment with `checkout_url`. |
| POST | `/orders/{id}/pay` | Online orders: open or reuse a payment attempt → `checkout_url`. Unpaid orders are cancelled and restocked after `PAYMENT_ONLINE_TIMEOUT_MINUTES` (default 30) by `payments:expire` (scheduled every minute). |
| GET / POST | `/sandbox/payments/{reference}` · `…/complete` (`outcome` = paid/failed) | Sandbox stand-in for a hosted checkout; sends itself a signed webhook |
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
| GET / POST | `/seller/appeals` | Appeal history / file an appeal (`message`, 20–3000 chars). Only while suspended, one open at a time — allowed outside the approval gate |
| GET | `/seller/dashboard?from&to` | KPIs, sales series, status breakdown, best sellers, low stock |
| GET | `/seller/finance` | Commission ledger + payout history |
| GET | `/seller/reports/sales?format=csv|pdf&from&to` | Download |
| GET / POST | `/seller/products` | List (filters `q, status, stock=low|out`) / create (multipart, `images[]`) |
| GET / POST / DELETE | `/seller/products/{id}` | Show / update (multipart) / soft delete |
| PATCH | `/seller/products/{id}/stock` | `stock, low_stock_threshold` |
| POST | `/seller/products/{id}/images` · PATCH `…/images/{imageId}/primary` · DELETE `…/images/{imageId}` | |
| GET | `/seller/orders`, `/seller/orders/{id}` | Own seller orders only (policy-checked) |
| PATCH | `/seller/orders/{id}/status` | `status` + `courier_code` (from `GET /couriers`, or `other` with `courier` name) and optional `tracking_number` when shipping, `reason` when cancelling. Transitions: pending → confirmed → packed → shipped → delivered (→ returned); cancel allowed until shipped. |

## Admin (`role:admin`)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/dashboard?from&to` · `/admin/reports/sales?format&from&to&seller_id` · `/admin/audit-logs` | |
| GET | `/admin/sellers?status&appeal=open&q`, `/admin/sellers/{id}` | Includes documents and appeals |
| GET | `/admin/sellers/{id}/trust` | Rating, report/listing/order counts, account history (from the audit log) |
| POST | `/admin/sellers/{id}/approve` · `/reject` (`reason`) · `/suspend` (`reason`) | Approve needs an accepted document (not when reinstating a suspended store). Reject: pending only. Suspend: approved only. |
| POST | `/admin/seller-appeals/{id}/decide` | `status` = accepted (reinstates) / denied (`admin_note` required) |
| PATCH | `/admin/sellers/{id}/commission` | `commission_rate` 0–50 or null for default |
| PATCH | `/admin/verifications/{id}` · GET `/admin/verifications/{id}/download` | `status` approved / rejected (`notes` required when rejecting); seller is notified |
| GET | `/admin/users` · PATCH `/admin/users/{id}/status` | Suspending revokes all tokens |
| GET POST PUT DELETE | `/admin/categories[/{id}]` | |
| GET | `/admin/products` · PATCH `/admin/products/{id}/moderation` | approved / flagged / removed. Listings auto-flag once `MARKETPLACE_AUTO_FLAG_REPORT_THRESHOLD` (default 3) customers have open reports |
| GET | `/admin/orders`, `/admin/orders/{id}` · PATCH `/admin/seller-orders/{id}/status` | Override with the same transition rules |
| GET | `/admin/refunds` · POST `/admin/refunds/{id}/decide` · POST `/admin/refunds/{id}/refunded` | |
| GET | `/admin/payouts` · POST `/admin/payouts` (`seller_id`) · POST `/admin/payouts/{id}/paid` | |
