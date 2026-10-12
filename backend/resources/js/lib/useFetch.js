import { useCallback, useEffect, useRef, useState } from 'react'
import { api, errorMessage } from './api'

/**
 * Small data hook: GET `url` with `params`, re-fetch when they change.
 * Returns { data, loading, error, reload, setData }.
 */
export function useFetch(url, params = undefined, { enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(Boolean(url && enabled))
  const [error, setError] = useState(null)
  const key = JSON.stringify(params ?? {})
  const seq = useRef(0)

  const load = useCallback(async () => {
    if (!url || !enabled) return
    const id = ++seq.current
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(url, { params: JSON.parse(key) })
      if (id === seq.current) setData(res.data)
    } catch (e) {
      if (id === seq.current) setError(errorMessage(e))
    } finally {
      if (id === seq.current) setLoading(false)
    }
  }, [url, key, enabled])

  useEffect(() => { load() }, [load])

  return { data, loading, error, reload: load, setData }
}

/** Debounce a fast-changing value (search boxes). */
export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}
