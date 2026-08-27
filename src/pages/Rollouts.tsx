import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, timeAgo, type Rollout } from '../api'
import { RolloutStateChip } from '../components/Status'
import { RolloutProgress } from '../components/RolloutProgress'

export default function Rollouts() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['rollouts'], queryFn: () => api.rollouts() })
  const pause = useMutation({
    mutationFn: (id: string) => api.pauseRollout(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rollouts'] }),
  })
  const resume = useMutation({
    mutationFn: (id: string) => api.resumeRollout(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rollouts'] }),
  })

  return (
    <>
      <div className="page-head">
        <h2>Rollouts</h2>
        <span className="sub">{isLoading ? 'loading…' : `${data?.length ?? 0} total`}</span>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {(data ?? []).map(r => (
          <Card key={r.id} r={r}
            onPause={() => pause.mutate(r.id)}
            onResume={() => resume.mutate(r.id)}
            busy={pause.isPending || resume.isPending} />
        ))}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <div className="card empty">No rollouts yet.</div>
        )}
      </div>
    </>
  )
}

function Card({ r, onPause, onResume, busy }: {
  r: Rollout; onPause: () => void; onResume: () => void; busy: boolean
}) {
  const active = r.state === 'running'
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <Link to={`/rollouts/${r.id}`}><strong>{r.version}</strong></Link>
        <span className="muted">→ {r.group}</span>
        <RolloutStateChip state={r.state} />
        <span className="muted">{r.strategy}</span>
        <span className="spacer" />
        <span className="muted">{timeAgo(r.created_at)}</span>
        {/* Abort is one click and always reachable. Pausing is safe and
            reversible; making it slow is not. No confirmation dialog. */}
        {active
          ? <button className="danger" onClick={onPause} disabled={busy}>Pause</button>
          : (r.state === 'paused' || r.state === 'halted')
            ? <button onClick={onResume} disabled={busy}>Resume</button>
            : null}
      </div>

      {r.halt_reason && (
        <div style={{
          marginBottom: 10, padding: '7px 10px', borderRadius: 6,
          border: '1px solid var(--critical)', color: 'var(--critical)',
        }}>
          ✕ Auto-halted — {r.halt_reason}
        </div>
      )}

      <RolloutProgress counts={r.counts} />
    </div>
  )
}
