import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, isStale, shortCommit, timeAgo, type Device } from '../api'
import { DeviceStatus, deviceStatus } from '../components/Status'

type Filter = 'all' | 'stale' | 'unhealthy' | 'pinned' | 'updating'

export default function Fleet() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['fleet'], queryFn: () => api.fleet(),
  })
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')

  const devices = data?.devices ?? []

  const stats = useMemo(() => {
    const s = { total: devices.length, stale: 0, unhealthy: 0, pinned: 0, updating: 0 }
    for (const d of devices) {
      if (isStale(d)) s.stale++
      if (!d.healthy) s.unhealthy++
      if (d.pinned) s.pinned++
      if (d.update_state !== 'idle' || d.pending_commit) s.updating++
    }
    return s
  }, [devices])

  const shown = useMemo(() => devices.filter(d => {
    if (q && !d.id.includes(q) && !d.app_version.includes(q)) return false
    switch (filter) {
      case 'stale': return isStale(d)
      case 'unhealthy': return !d.healthy
      case 'pinned': return d.pinned
      case 'updating': return d.update_state !== 'idle' || !!d.pending_commit
      default: return true
    }
  }), [devices, filter, q])

  if (error) return <div className="card">Failed to load fleet: {String(error)}</div>

  return (
    <>
      <div className="page-head">
        <h2>Fleet</h2>
        <span className="sub">{isLoading ? 'loading…' : `${stats.total} devices`}</span>
      </div>

      {/* Attention-worthy counts are coloured; the plain total is not. */}
      <div className="tiles">
        <Tile label="Devices" value={stats.total} />
        <Tile label="Updating" value={stats.updating} />
        <Tile label="Stale" value={stats.stale} attention={stats.stale > 0} />
        <Tile label="Unhealthy" value={stats.unhealthy} attention={stats.unhealthy > 0} />
        <Tile label="Pinned" value={stats.pinned} attention={stats.pinned > 0} />
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <input placeholder="search id or version" value={q}
            onChange={e => setQ(e.target.value)} style={{ width: 200 }} />
          <select value={filter} onChange={e => setFilter(e.target.value as Filter)}>
            <option value="all">All devices</option>
            <option value="updating">Updating</option>
            <option value="stale">Stale</option>
            <option value="unhealthy">Unhealthy</option>
            <option value="pinned">Pinned</option>
          </select>
          <span className="spacer" />
          <span className="muted">{shown.length} shown</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Device</th><th>Group</th><th>Status</th>
                <th>Booted</th><th>Pending</th><th>App</th><th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, 200).map(d => <Row key={d.id} d={d} />)}
            </tbody>
          </table>
          {shown.length === 0 && <div className="empty">No devices match.</div>}
          {shown.length > 200 && (
            <div className="empty">Showing first 200 of {shown.length}. Narrow the filter.</div>
          )}
        </div>
      </div>
    </>
  )
}

function Row({ d }: { d: Device }) {
  const st = deviceStatus(d)
  return (
    <tr>
      <td><Link to={`/devices/${d.id}`} className="mono">{d.id}</Link></td>
      <td>{d.group}</td>
      <td title={d.pin_reason ?? st.label}><DeviceStatus device={d} /></td>
      <td className="mono">{shortCommit(d.booted_commit)}</td>
      {/* Booted and pending are separate columns on purpose: a device that has
          downloaded but not rebooted is NOT updated. */}
      <td className="mono">{d.pending_commit ? shortCommit(d.pending_commit) : <span className="muted">—</span>}</td>
      <td>{d.app_version}</td>
      <td className={isStale(d) ? '' : 'muted'}>{timeAgo(d.last_seen)}</td>
    </tr>
  )
}

function Tile({ label, value, attention }: { label: string; value: number; attention?: boolean }) {
  return (
    <div className="card tile">
      <div className="label">{label}</div>
      <div className={`value${attention ? ' attention' : ''}`}>{value}</div>
    </div>
  )
}
