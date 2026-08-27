import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api, shortCommit, timeAgo } from '../api'
import { DeviceStatus, RolloutStateChip } from '../components/Status'
import { RolloutProgress } from '../components/RolloutProgress'

export default function RolloutDetail() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const { data: r, error } = useQuery({ queryKey: ['rollout', id], queryFn: () => api.rollout(id) })
  const { data: devices } = useQuery({
    queryKey: ['rollout-devices', id], queryFn: () => api.rolloutDevices(id),
  })
  const pause = useMutation({
    mutationFn: () => api.pauseRollout(id),
    onSuccess: () => qc.invalidateQueries(),
  })
  const resume = useMutation({
    mutationFn: () => api.resumeRollout(id),
    onSuccess: () => qc.invalidateQueries(),
  })

  if (error) return <div className="card">Not found: {String(error)}</div>
  if (!r) return <div className="card">Loading…</div>

  return (
    <>
      <div className="page-head">
        <h2>{r.version}</h2>
        <span className="sub">→ {r.group} · {r.strategy}</span>
        <RolloutStateChip state={r.state} />
        <span className="spacer" />
        {r.state === 'running'
          ? <button className="danger" onClick={() => pause.mutate()}>Pause rollout</button>
          : (r.state === 'paused' || r.state === 'halted')
            ? <button onClick={() => resume.mutate()}>Resume</button>
            : null}
      </div>

      {r.halt_reason && (
        <div className="card" style={{ borderColor: 'var(--critical)', color: 'var(--critical)', marginBottom: 12 }}>
          ✕ <strong>Auto-halted.</strong> {r.halt_reason}. Devices already updated are unaffected;
          nothing further will be offered until you resume.
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <RolloutProgress counts={r.counts} />
        <div className="muted" style={{ marginTop: 10 }}>
          commit <span className="mono">{shortCommit(r.commit)}</span> ·
          halts above {r.halt_on_failure_pct}% failures · started {timeAgo(r.created_at)}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Device</th><th>Status</th><th>Booted</th><th>Pending</th><th>App</th><th>Last seen</th></tr>
            </thead>
            <tbody>
              {(devices ?? []).slice(0, 200).map(d => (
                <tr key={d.id}>
                  <td><Link to={`/devices/${d.id}`} className="mono">{d.id}</Link></td>
                  <td title={d.pin_reason ?? ''}><DeviceStatus device={d} /></td>
                  <td className="mono">{shortCommit(d.booted_commit)}</td>
                  <td className="mono">{d.pending_commit ? shortCommit(d.pending_commit) : <span className="muted">—</span>}</td>
                  <td>{d.app_version}</td>
                  <td className="muted">{timeAgo(d.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
