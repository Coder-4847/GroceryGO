import { useCallback, useRef, useState } from 'react'
import { searchItem } from '../lib/api.js'

/**
 * Drives a single search request with cancellation of any in-flight one.
 * status: 'idle' | 'loading' | 'done' | 'error'
 */
export function useSearch() {
  const [state, setState] = useState({ status: 'idle', query: '', data: null, error: null })
  const abortRef = useRef(null)

  const run = useCallback(async (rawQuery, { fresh = false } = {}) => {
    const query = rawQuery.trim()
    if (!query) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState((s) => ({
      status: 'loading',
      query,
      // keep previous data around so the grid can cross-fade
      data: s.query === query ? s.data : null,
      error: null,
    }))

    try {
      const data = await searchItem(query, { signal: controller.signal, fresh })
      if (controller.signal.aborted) return
      setState({ status: 'done', query, data, error: null })
    } catch (err) {
      if (err.name === 'AbortError') return
      setState({ status: 'error', query, data: null, error: err.message || 'Search failed' })
    }
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState({ status: 'idle', query: '', data: null, error: null })
  }, [])

  return { ...state, run, reset }
}
