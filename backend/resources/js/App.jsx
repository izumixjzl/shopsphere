import { lazy, Suspense } from 'react'
import { Outlet, Route, Routes } from 'react-router-dom'
import {
  BarChart3, ClipboardList, Flag, FolderTree, History, LayoutDashboard, LifeBuoy, Package, Settings, ShoppingCart, Store, Users, Wallet,
} from 'lucide-react'
import { GuestOnly, RequireRole } from './components/RouteGuards'
import { Button, EmptyState, PageLoader } from './components/ui'
import { useAuth } from './context/AuthContext'
import DashboardLayout from './layouts/DashboardLayout'
import StoreLayout from './layouts/StoreLayout'
import Home from './pages/store/Home'

// Storefront pages load eagerly-ish; dashboards are split out so shoppers never download Chart.js.
const Shop = lazy(() => import('./pages/store/Shop'))
const ProductDetail = lazy(() => import('./pages/store/ProductDetail'))
const StorePage = lazy(() => import('./pages/store/StorePage'))
const Cart = lazy(() => import('./pages/store/Cart'))
const Checkout = lazy(() => import('./pages/store/Checkout'))
const SandboxPay = lazy(() => import('./pages/store/SandboxPay'))
const Orders = lazy(() => import('./pages/account/Orders'))
const OrderDetail = lazy(() => import('./pages/account/OrderDetail'))
const Returns = lazy(() => import('./pages/account/Returns'))
const Wishlist = lazy(() => import('./pages/account/Wishlist'))
const Account = lazy(() => import('./pages/account/Account'))
const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const Notifications = lazy(() => import('./pages/Notifications'))

const SellerDashboard = lazy(() => import('./pages/seller/SellerDashboard'))
const SellerProducts = lazy(() => import('./pages/seller/SellerProducts'))
const ProductForm = lazy(() => import('./pages/seller/ProductForm'))
const SellerOrders = lazy(() => import('./pages/seller/SellerOrders'))
const SellerOrderDetail = lazy(() => import('./pages/seller/SellerOrderDetail'))
const SellerFinance = lazy(() => import('./pages/seller/SellerFinance'))
const StoreSettings = lazy(() => import('./pages/seller/StoreSettings'))
const SellerReturns = lazy(() => import('./pages/seller/SellerReturns'))
const SellerPending = lazy(() => import('./pages/seller/SellerPending'))

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminSellers = lazy(() => import('./pages/admin/AdminSellers'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'))
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'))
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders').then((m) => ({ default: m.AdminOrders })))
const AdminOrderDetail = lazy(() => import('./pages/admin/AdminOrders').then((m) => ({ default: m.AdminOrderDetail })))
const AdminPayouts = lazy(() => import('./pages/admin/AdminPayouts'))
const AdminAuditLogs = lazy(() => import('./pages/admin/AdminAuditLogs'))
const AdminReports = lazy(() => import('./pages/admin/AdminReports'))

const SELLER_NAV = [
  ['/seller', 'Overview', LayoutDashboard, true],
  ['/seller/orders', 'Orders', ClipboardList],
  ['/seller/returns', 'Returns', LifeBuoy],
  ['/seller/products', 'Products', Package],
  ['/seller/finance', 'Earnings', Wallet],
  ['/seller/store', 'Store settings', Settings],
]

const ADMIN_NAV = [
  ['/admin', 'Overview', BarChart3, true],
  ['/admin/sellers', 'Sellers', Store],
  ['/admin/orders', 'Orders', ShoppingCart],
  ['/admin/products', 'Listings', Package],
  ['/admin/reports', 'Reports', Flag],
  ['/admin/categories', 'Categories', FolderTree],
  ['/admin/payouts', 'Payouts', Wallet],
  ['/admin/users', 'Users', Users],
  ['/admin/audit-logs', 'Audit log', History],
]

/** Selling tools stay locked until the store is approved. */
function ApprovedSellerOnly() {
  const { sellerStatus } = useAuth()
  return sellerStatus === 'approved' ? <Outlet /> : <SellerPending />
}

function NotFound() {
  return <EmptyState title="Page not found" action={<Button to="/">Go to the homepage</Button>}>The link may be broken or the page may have moved.</EmptyState>
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<StoreLayout />}>
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="products/:slug" element={<ProductDetail />} />
          <Route path="stores/:slug" element={<StorePage />} />
          <Route element={<RequireRole roles={['customer']} />}>
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="sandbox-pay/:reference" element={<SandboxPay />} />
            <Route path="account" element={<Account />} />
            <Route path="account/orders" element={<Orders />} />
            <Route path="account/orders/:id" element={<OrderDetail />} />
            <Route path="account/wishlist" element={<Wishlist />} />
            <Route path="account/returns" element={<Returns />} />
            <Route path="account/notifications" element={<Notifications framed />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route element={<GuestOnly />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
        </Route>

        <Route element={<RequireRole roles={['seller']} />}>
          <Route path="seller" element={<DashboardLayout nav={SELLER_NAV} area="Seller" />}>
            <Route path="store" element={<StoreSettings />} />
            {/* Outside the approval gate so pending sellers can read their approval notices. */}
            <Route path="notifications" element={<Notifications />} />
            <Route element={<ApprovedSellerOnly />}>
              <Route index element={<SellerDashboard />} />
              <Route path="orders" element={<SellerOrders />} />
              <Route path="orders/:id" element={<SellerOrderDetail />} />
              <Route path="returns" element={<SellerReturns />} />
              <Route path="products" element={<SellerProducts />} />
              <Route path="products/new" element={<ProductForm />} />
              <Route path="products/:id" element={<ProductForm />} />
              <Route path="finance" element={<SellerFinance />} />
            </Route>
          </Route>
        </Route>

        <Route element={<RequireRole roles={['admin']} />}>
          <Route path="admin" element={<DashboardLayout nav={ADMIN_NAV} area="Admin" />}>
            <Route index element={<AdminDashboard />} />
            <Route path="sellers" element={<AdminSellers />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:id" element={<AdminOrderDetail />} />
            <Route path="payouts" element={<AdminPayouts />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
