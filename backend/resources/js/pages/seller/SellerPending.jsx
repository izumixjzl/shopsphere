import { Clock, XCircle } from 'lucide-react'
import { Button } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'

/** Shown instead of selling tools until an admin approves the store. */
export default function SellerPending() {
  const { user } = useAuth()
  const p = user?.seller_profile
  const rejected = p?.status === 'rejected'
  const suspended = p?.status === 'suspended'

  return (
    <div className="card mx-auto mt-6 max-w-xl p-8 text-center">
      <div className={`mx-auto grid size-14 place-items-center rounded-full ${rejected || suspended ? 'bg-coral-tint text-coral' : 'bg-mango-tint text-[#8a5a00]'}`}>
        {rejected || suspended ? <XCircle className="size-6" /> : <Clock className="size-6" />}
      </div>
      <h1 className="mt-4 text-2xl font-bold">
        {rejected ? 'Your application needs changes' : suspended ? 'Your store is suspended' : `${p?.store_name} is under review`}
      </h1>
      <p className="mt-2 text-ink-soft">
        {rejected || suspended
          ? `Reason: ${p?.rejection_reason || 'not given'}. Update your store details or upload new documents to apply again.`
          : 'An administrator reviews every new store. Uploading a business permit or valid ID speeds this up. You will get a notification when you are approved.'}
      </p>
      <Button className="mt-6" to="/seller/store">Complete store details</Button>
    </div>
  )
}
