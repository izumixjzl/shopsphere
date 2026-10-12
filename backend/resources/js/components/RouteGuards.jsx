import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { homeFor, useAuth } from '../context/AuthContext'
import { PageLoader } from './ui'

/** Only lets through signed-in users with one of `roles`. */
export function RequireRole({ roles }) {
  const { user, booting } = useAuth()
  const location = useLocation()

  if (booting) return <PageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />
  return <Outlet />
}

/** Login/register pages: bounce signed-in users to their home. */
export function GuestOnly() {
  const { user, booting } = useAuth()
  if (booting) return <PageLoader />
  if (user) return <Navigate to={homeFor(user)} replace />
  return <Outlet />
}
