import { useQuery } from '@tanstack/react-query'
import { api, formatBytes, shortCommit, timeAgo } from '../api'

export default function Targets() {
  const { data, isLoading } = useQuery({ queryKey: ['targets'], queryFn: () => api.targets() })

  return (
    <>
      <div className="page-head">
        <h2>Builds</h2>
        <span className="sub">{isLoading ? 'loading…' : `${data?.length ?? 0} targets`}</span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Version</th><th>Branch</th><th>Commit</th>
                <th>Image size</th><th>Delta</th><th>Published</th><th>By</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map(t => {
                // Delta size is what devices actually download, and a delta near
                // full-image size is the tell that reproducible builds broke in
                // meta-ota-platform. Worth flagging in the table itself.
                const suspect = t.delta_bytes !== null && t.delta_bytes > t.size_bytes * 0.5
                return (
                  <tr key={t.commit}>
                    <td><strong>{t.version}</strong></td>
                    <td className="muted">{t.branch}</td>
                    <td className="mono">{shortCommit(t.commit)}</td>
                    <td>{formatBytes(t.size_bytes)}</td>
                    <td style={suspect ? { color: 'var(--warning)' } : undefined}
                        title={suspect ? 'Delta is over half the full image — check reproducibility' : ''}>
                      {suspect && '▲ '}{formatBytes(t.delta_bytes)}
                    </td>
                    <td className="muted">{timeAgo(t.created_at)}</td>
                    <td className="muted">{t.created_by}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!isLoading && (data?.length ?? 0) === 0 && (
            <div className="empty">
              No builds published. CI registers targets via <code>POST /api/v1/targets</code> —
              the UI never uploads firmware.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
