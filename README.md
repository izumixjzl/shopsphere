# ShopSphere

A multi-vendor e-commerce marketplace: independent sellers run their own storefronts, customers buy from several stores in one cart, and a super admin approves sellers, moderates listings and settles commissions.

Built as a full-stack portfolio project with **React 19 + Tailwind CSS 4** on the front end and a **Laravel 12 REST API + MySQL + Sanctum** on the back end, as a modular monolith.

## What works

**Customers** browse and search the catalog (category, price, rating and stock filters, five sort orders), view product pages with galleries and verified reviews, keep a wishlist and address book, add items from different stores to one cart, check out with Cash on Delivery, track each store's shipment, cancel before processing, review delivered items, and file return or dispute requests.

**Sellers** apply with store details and verification documents, then — once approved — manage products with SKUs, multi-image upload and stock levels, get low-stock alerts, confirm → pack → ship (courier + tracking number) → deliver their part of each order, and see sales charts, best sellers, commission ledger, payout history and CSV/PDF reports.

**Super admin** approves, rejects or suspends sellers, reviews their documents, sets per-seller commission, manages users and categories, flags or removes listings, oversees every order (with override), resolves returns and refunds, bundles payable earnings into payouts, reads the audit log, and downloads marketplace-wide reports.

### How the hard parts work

- **Order splitting** — one checkout creates one parent `orders` row and one `seller_orders` row per store, each with its own status, shipping fee, commission and shipment. The parent status is derived from its children.
- **No overselling** — checkout is a single DB transaction that locks every inventory row (`SELECT … FOR UPDATE`, in a fixed order to avoid deadlocks) before deducting; the stock column is unsigned. If any item ran out, nothing is written. Cancellations and returns put stock back.
- **Price history** — order items snapshot name, SKU, image and price, and the address is snapshotted on the order.
- **Authorization in three layers** — `role:` middleware per area, a `seller.approved` gate for selling tools, and Policies for ownership (a seller can never read or touch another seller's products or orders).
- **COD payment** — a pending payment is created at checkout and marked paid (simulated confirmation) when every part is delivered.

See [`docs/DATABASE.md`](docs/DATABASE.md) for the ERD and schema decisions and [`docs/API.md`](docs/API.md) for every endpoint.

## Project structure

```
shopsphere/
├── backend/                 Laravel 12 API
│   ├── app/Enums            Roles and status state machines
│   ├── app/Http/Controllers Auth, Catalog, Customer/*, Seller/*, Admin/*
│   ├── app/Http/Middleware  EnsureRole, EnsureSellerApproved
│   ├── app/Policies         Product, SellerOrder, Order, Address ownership
│   ├── app/Services         Checkout, Inventory, SellerOrder (fulfilment), Analytics, Report, Notification, AuditLogger, Money
│   ├── database/migrations  All 22 domain tables + Laravel/Sanctum tables
│   ├── database/seeders     Demo marketplace with real orders placed through the services
│   └── tests                Feature tests for auth, roles, products, checkout, stock, fulfilment, reviews
├── frontend/                React + Vite + Tailwind
│   └── src/{layouts,components,pages/{store,account,auth,seller,admin},context,lib}
└── docs/
```

## Running locally

Requirements: PHP 8.2+, Composer, MySQL 8, Node 20+.

```bash
# 1. API
cd backend
composer install
cp .env.example .env          # set DB_DATABASE / DB_USERNAME / DB_PASSWORD
php artisan key:generate
php artisan migrate --seed
php artisan storage:link      # serves uploaded product images
php artisan serve             # http://localhost:8000

# 2. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:8000/api
npm run dev                   # http://localhost:5173
```

Demo accounts (password `password123`): `customer@shopsphere.test`, `seller1@shopsphere.test` (also seller2, seller3), `pending@shopsphere.test` (awaiting approval), `admin@shopsphere.test`. The login page has one-click buttons for these.

Run the tests (uses in-memory SQLite):

```bash
cd backend && php artisan test
```

Optional: `php artisan schedule:work` sends sellers a daily low-stock digest.

### Image storage

Uploads go to the disk named in `FILESYSTEM_DISK`. `public` works out of the box. For Cloudinary, S3, R2 or any S3-compatible bucket, run `composer require league/flysystem-aws-s3-v3`, fill the `AWS_*` values (plus `AWS_ENDPOINT` for non-AWS providers), and set `FILESYSTEM_DISK=s3`. Seller verification documents always stay on the private `local` disk.

## Roadmap

The MVP uses Cash on Delivery with simulated payment confirmation. Next steps:

1. Payment gateway (PayMongo / Xendit: GCash, Maya, cards) behind a `PaymentGateway` interface.
2. Automatic refunds through the gateway, and partial-refund commission adjustments.
3. Scheduled seller payouts and bank account verification.
4. Real-time notifications (Laravel Reverb) and email channels.
5. Product variants (size/colour) with per-variant stock.
