import { useState } from 'react'
import { Film } from 'lucide-react'
import { Modal } from './ui'

/** Proof photos/videos on a return request: small thumbnails that open a full-size viewer. */
export default function Evidence({ refund, size = 'size-10' }) {
  const [open, setOpen] = useState(false)
  const files = refund.attachments

  if (!files?.length) return <span className="text-xs text-ink-mute">No proof attached</span>

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1" aria-label={`View ${files.length} proof file${files.length > 1 ? 's' : ''}`}>
        {files.slice(0, 3).map((f) => (
          <span key={f.id} className={`relative ${size} overflow-hidden rounded-lg bg-paper`}>
            {f.kind === 'video'
              ? <><video src={f.url} muted preload="metadata" className="size-full object-cover" /><Film className="absolute bottom-0.5 left-0.5 size-3 text-white drop-shadow" /></>
              : <img src={f.url} alt="" className="size-full object-cover" />}
          </span>
        ))}
        {files.length > 3 && <span className="text-xs font-medium text-ink-soft">+{files.length - 3}</span>}
      </button>

      {open && (
        <Modal open onClose={() => setOpen(false)} size="lg" title={`Proof · ${refund.order_item?.product_name ?? 'Request'}`}>
          <p className="mb-4 text-sm text-ink-soft">{refund.reason}{refund.details && ` — ${refund.details}`}</p>
          <div className="grid gap-4">
            {files.map((f) => (
              <figure key={f.id}>
                {f.kind === 'video'
                  ? <video src={f.url} controls className="max-h-[60vh] w-full rounded-xl bg-ink" />
                  : <img src={f.url} alt={f.original_name} className="max-h-[60vh] w-full rounded-xl bg-paper object-contain" />}
                <figcaption className="mt-1 flex justify-between gap-3 text-xs text-ink-mute">
                  <span className="truncate">{f.original_name}</span>
                  <a href={f.url} target="_blank" rel="noreferrer" className="shrink-0 font-medium text-sphere hover:underline">Open original</a>
                </figcaption>
              </figure>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}
