import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role="status"
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg shadow-ink/20">
            {t.type === 'error'
              ? <AlertCircle className="mt-0.5 size-4 shrink-0 text-coral" />
              : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mango" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} aria-label="Dismiss" className="text-white/60 hover:text-white">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
