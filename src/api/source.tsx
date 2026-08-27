// Runtime data-source switch.
//
// Which backend the dashboard talks to is a thing you flip many times a day
// during bring-up, so it is a runtime choice persisted in localStorage rather
// than a build-time env var. VITE_USE_MOCK still decides the *initial* value,
// so a demo build (`npm run build:demo`) still opens on the mock fleet.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Api } from './types'
import { httpApi } from './client'
import { mockApi } from './mock'

export type Source = 'mock' | 'live'

const KEY = 'ota.dataSource'

function initialSource(): Source {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'mock' || saved === 'live') return saved
  } catch {
    // Private windows and blocked site-data throw on access; fall through.
  }
  return import.meta.env.VITE_USE_MOCK === '1' ? 'mock' : 'live'
}

/** Module-level, so the `api` proxy below can resolve without React context. */
let current: Source = initialSource()

export function apiFor(s: Source): Api {
  return s === 'mock' ? mockApi : httpApi
}

/**
 * Stable `api` object that dispatches to whichever source is selected. Pages
 * keep calling `api.fleet()` and never think about the switch; only the query
 * keys need to know, so that flipping sources refetches instead of showing
 * the other backend's cached rows.
 */
export const api: Api = new Proxy({} as Api, {
  get(_t, prop: string) {
    return (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (apiFor(current) as any)[prop](...args)
  },
})

const Ctx = createContext<{ source: Source; setSource: (s: Source) => void }>({
  source: current, setSource: () => {},
})

export function SourceProvider({ children }: { children: ReactNode }) {
  const [source, setSourceState] = useState<Source>(current)

  useEffect(() => { current = source }, [source])

  const setSource = useCallback((s: Source) => {
    current = s
    setSourceState(s)
    try { localStorage.setItem(KEY, s) } catch { /* non-fatal */ }
  }, [])

  const value = useMemo(() => ({ source, setSource }), [source, setSource])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSource() {
  return useContext(Ctx)
}
