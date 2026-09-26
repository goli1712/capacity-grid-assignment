import { useCallback, useSyncExternalStore } from 'react'
import { defaultRange, expandRange, type Range } from './weeks'

const NAVIGATE = 'capacity:navigate'

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  window.addEventListener(NAVIGATE, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(NAVIGATE, onChange)
  }
}

const getSearch = () => window.location.search

export type SetRange = (next: Range | null, options?: { replace?: boolean }) => void

// The range lives in ?from=&to=. No params means the default window, so
// "Today" leaves a clean URL that always opens on the viewer's current week.
export function useUrlRange(): [Range, SetRange] {
  const search = useSyncExternalStore(subscribe, getSearch)
  const params = new URLSearchParams(search)
  const range =
    params.has('from') || params.has('to')
      ? { from: params.get('from') ?? '', to: params.get('to') ?? '' }
      : defaultRange()

  const setRange = useCallback<SetRange>((next, { replace = false } = {}) => {
    const url = new URL(window.location.href)
    url.search = next ? `?${new URLSearchParams(expandRange(next))}` : ''
    if (url.href === window.location.href) return
    if (replace) window.history.replaceState(null, '', url)
    else window.history.pushState(null, '', url)
    window.dispatchEvent(new Event(NAVIGATE))
  }, [])

  return [range, setRange]
}
