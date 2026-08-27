import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api, isStale, shortCommit, timeAgo, useSource } from '../api'
import { DeviceStatus, StatusChip } from '../components/Status'

export default function DeviceDetail() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const { source } = useSource()
  const { data: d, error } = useQuery({ queryKey: ['device', id, source], queryFn: () => api.device(id) })
  const { data: events } = useQuery({
    queryKey: ['device-events', id, source], queryFn: () => api.deviceEvents(id),
  })
  const pin = useMutation({
    mutationFn: (pinned: boolean) => api.setPinned(id, pinned),
    onSuccess: () => qc.invalidateQueries(),
  })

  if (error) return <div className="card">Not found: {String(error)}</div>
  if (!d) return <div className="card">Loading…</div>

  return (
    <>
      <div className="page-head">
        <h2 className="mono">{d.id}</h2>
        <DeviceStatus device={d} />
        <span className="spacer" />
        <button onClick={() => pin.mutate(!d.pinned)} disabled={pin.isPending}>
          {d.pinned ? 'Unpin' : 'Pin'}
        </button>
      </div>

      {/* A pin without a reason gets unpinned by whoever finds it. Most pins are
          automatic -- set by the server after a rollback -- so always say why. */}
      {d.pinned && (
        <div className="card" style={{ marginBottom: 12, borderColor: 'var(--serious)' }}>
          <StatusChip role="serious" label="Pinned" />{' '}
          — {d.pin_reason ?? 'no reason recorded'}. This device will not be offered updates.
        </div>
      )}

      {isStale(d) && (
        <div className="card" style={{ marginBottom: 12, borderColor: 'var(--warning)' }}>
          <StatusChip role="warning" label="Stale" />{' '}
          — last heartbeat {timeAgo(d.last_seen)}. Its state below may be out of date.
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', margin: 0 }}>
          <dt className="muted">Group</dt><dd style={{ margin: 0 }}>{d.group}</dd>
          <dt className="muted">Branch</dt><dd style={{ margin: 0 }}>{d.branch}</dd>
          <dt className="muted">Hardware</dt><dd style={{ margin: 0 }}>{d.hardware_id}</dd>
          <dt className="muted">Booted commit</dt>
          <dd style={{ margin: 0 }} className="mono">{d.booted_commit}</dd>
          <dt className="muted">Pending commit</dt>
          <dd style={{ margin: 0 }} className="mono">
            {d.pending_commit ?? <span className="muted">none</span>}
          </dd>
          <dt className="muted">App version</dt><dd style={{ margin: 0 }}>{d.app_version}</dd>
          <dt className="muted">Last seen</dt><dd style={{ margin: 0 }}>{timeAgo(d.last_seen)}</dd>
        </dl>
      </div>

      <div className="card">
        <div className="muted" style={{ marginBottom: 8 }}>Event history</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Kind</th><th>Detail</th></tr></thead>
            <tbody>
              {(events ?? []).map((e, i) => (
                <tr key={i}>
                  <td className="muted">{timeAgo(e.ts)}</td>
                  <td>
                    {e.result === 'rollback'
                      ? <StatusChip role="serious" label="rollback" />
                      : e.result === 'success'
                        ? <StatusChip role="good" label="success" />
                        : e.kind}
                  </td>
                  <td>{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(events?.length ?? 0) === 0 && <div className="empty">No events recorded.</div>}
        </div>
      </div>
      <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
        Commit <span className="mono">{shortCommit(d.booted_commit)}</span> is what is running now.
      </div>
    </>
  )
}
