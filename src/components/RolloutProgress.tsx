// The rollout progress breakdown.
//
// Deliberately NOT a single percentage. "73% complete" hides the only two
// numbers that matter during a rollout -- failed and rolled back -- so this
// renders every stage as its own segment with its own count, and states the
// failure figures in words underneath.
//
// Colour: the in-flight stages are one sequential blue ramp (light = earlier),
// because they are ordered stages of one pipeline. Terminal outcomes take
// reserved status colours. Segments carry a 2px surface gap so adjacent fills
// stay legible without borders.

import type { RolloutCounts } from '../api'

type Seg = { key: keyof RolloutCounts; label: string; color: string }

const SEGMENTS: Seg[] = [
  { key: 'confirmed',      label: 'confirmed',      color: 'var(--good)' },
  { key: 'pending_reboot', label: 'pending reboot', color: 'var(--stage-3)' },
  { key: 'downloading',    label: 'downloading',    color: 'var(--stage-2)' },
  { key: 'offered',        label: 'offered',        color: 'var(--stage-1)' },
  { key: 'rolled_back',    label: 'rolled back',    color: 'var(--serious)' },
  { key: 'failed',         label: 'failed',         color: 'var(--critical)' },
  { key: 'waiting',        label: 'waiting',        color: 'var(--hairline)' },
]

export function RolloutProgress({ counts }: { counts: RolloutCounts }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) return <div className="muted">No devices in this rollout.</div>

  const attempted = counts.confirmed + counts.failed + counts.rolled_back
  const bad = counts.failed + counts.rolled_back
  const failurePct = attempted ? (bad / attempted) * 100 : 0

  return (
    <div>
      <div
        role="img"
        aria-label={SEGMENTS.filter(s => counts[s.key] > 0)
          .map(s => `${counts[s.key]} ${s.label}`).join(', ')}
        style={{ display: 'flex', gap: 2, height: 14, marginBottom: 10 }}
      >
        {SEGMENTS.map(s => {
          const v = counts[s.key]
          if (!v) return null
          return (
            <div
              key={s.key}
              title={`${s.label}: ${v}`}
              style={{
                flex: v, background: s.color, borderRadius: 3, minWidth: 3,
              }}
            />
          )
        })}
      </div>

      {/* Legend doubles as the numbers -- identity is never colour-alone. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px' }}>
        {SEGMENTS.map(s => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden="true" style={{
              width: 9, height: 9, borderRadius: 2, background: s.color,
              outline: '1px solid var(--border)',
            }} />
            <span className="muted">{s.label}</span>
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{counts[s.key]}</strong>
          </span>
        ))}
      </div>

      {attempted > 0 && (
        <div style={{ marginTop: 10, color: bad ? 'var(--critical)' : 'var(--ink-secondary)' }}>
          {bad} of {attempted} attempted failed — <strong>{failurePct.toFixed(1)}%</strong> failure rate
        </div>
      )}
    </div>
  )
}
