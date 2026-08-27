// The mock/live toggle, plus an honest reachability indicator for live mode.
//
// A dashboard that silently shows an empty fleet because the server is down is
// worse than one that says so: "no devices" and "cannot reach the server" look
// identical in a table, and only one of them is your problem.

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSource, type Source } from '../api'

function useServerReachable(enabled: boolean) {
  return useQuery({
    queryKey: ['healthz'],
    queryFn: async () => {
      const res = await fetch('/api/v1/fleet', { method: 'GET' })
      if (!res.ok) throw new Error(String(res.status))
      return true
    },
    enabled,
    retry: false,
    refetchInterval: 5000,
  })
}

export function SourceSwitch() {
  const { source, setSource } = useSource()
  const qc = useQueryClient()
  const live = source === 'live'
  const health = useServerReachable(live)

  function pick(s: Source) {
    if (s === source) return
    setSource(s)
    // The two sources are different worlds; never let one's rows linger while
    // the other loads.
    qc.clear()
  }

  return (
    <div style={{ margin: '16px 16px 0', fontSize: 12 }}>
      <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
        {(['mock', 'live'] as Source[]).map(s => (
          <button
            key={s}
            onClick={() => pick(s)}
            aria-pressed={source === s}
            style={{
              flex: 1, border: 0, borderRadius: 0, padding: '6px 8px',
              background: source === s ? 'var(--accent)' : 'transparent',
              color: source === s ? '#fff' : 'var(--ink-secondary)',
              fontWeight: source === s ? 600 : 400,
            }}
          >
            {s === 'mock' ? 'Mock' : 'Live'}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 6, color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
        {!live ? (
          <><span style={{ color: 'var(--warning)' }}>▲</span> Simulated fleet — no server.</>
        ) : health.isLoading ? (
          <><span className="muted">○</span> Connecting…</>
        ) : health.isError ? (
          <>
            <span style={{ color: 'var(--critical)' }}>✕</span> Server unreachable.
            <div className="muted" style={{ marginTop: 2 }}>
              Start <code>ota-server</code> on :8000
            </div>
          </>
        ) : (
          <><span style={{ color: 'var(--good)' }}>●</span> Connected to ota-server.</>
        )}
      </div>
    </div>
  )
}
