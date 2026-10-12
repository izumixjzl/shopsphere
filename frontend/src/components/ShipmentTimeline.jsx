import { dateTime } from '../lib/format'

const STEPS = [
  ['pending', 'Order placed'],
  ['confirmed', 'Confirmed by seller'],
  ['packed', 'Packed'],
  ['shipped', 'Shipped'],
  ['delivered', 'Delivered'],
]

/** Horizontal progress for one seller order + the courier event log underneath. */
export default function ShipmentTimeline({ sellerOrder }) {
  const { status, shipment } = sellerOrder
  if (status === 'cancelled') {
    return <p className="text-sm text-coral">Cancelled{sellerOrder.cancel_reason ? `: ${sellerOrder.cancel_reason}` : ''}</p>
  }
  const reached = Math.max(0, STEPS.findIndex(([s]) => s === (status === 'returned' ? 'delivered' : status)))
  const stamps = { pending: sellerOrder.created_at, confirmed: sellerOrder.confirmed_at, shipped: sellerOrder.shipped_at, delivered: sellerOrder.delivered_at }

  return (
    <div>
      <ol className="grid grid-cols-5 gap-1" aria-label="Order progress">
        {STEPS.map(([key, label], i) => (
          <li key={key} className="text-center" aria-current={i === reached ? 'step' : undefined}>
            <div className={`h-1.5 rounded-full ${i <= reached ? 'bg-sphere' : 'bg-line'}`} />
            <div className={`mt-2 text-xs ${i <= reached ? 'font-semibold text-ink' : 'text-ink-mute'}`}>{label}</div>
            {stamps[key] && i <= reached && <div className="text-[11px] text-ink-mute">{dateTime(stamps[key])}</div>}
          </li>
        ))}
      </ol>
      {shipment?.courier && (
        <div className="mt-4 rounded-lg bg-paper px-4 py-3 text-sm">
          <span className="text-ink-soft">Courier:</span> <span className="font-semibold">{shipment.courier}</span>
          {shipment.tracking_number && <> · <span className="text-ink-soft">Tracking no.</span> <span className="font-mono font-semibold">{shipment.tracking_number}</span></>}
          {shipment.tracking_events?.length > 0 && (
            <ul className="mt-2 space-y-1 border-l-2 border-line pl-3">
              {[...shipment.tracking_events].reverse().map((e, i) => (
                <li key={i} className="text-ink-soft"><span className="text-ink">{e.note}</span> · {dateTime(e.at)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
