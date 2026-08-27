// Status colours are reserved and never carry meaning alone: every chip pairs a
// colour with an icon glyph AND a word. On a light surface `warning` and
// `serious` sit below 3:1 contrast by design -- the label is the mitigation, so
// never strip it to save space.

import type { Device } from '../api'
import { isStale } from '../api'

export type StatusRole = 'good' | 'warning' | 'serious' | 'critical' | 'neutral'

const GLYPH: Record<StatusRole, string> = {
  good: '●', warning: '▲', serious: '◆', critical: '✕', neutral: '○',
}

export function StatusChip({ role, label }: { role: StatusRole; label: string }) {
  const color = role === 'neutral' ? 'var(--ink-muted)' : `var(--${role})`
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
      <span aria-hidden="true" style={{ color, fontSize: 11, lineHeight: 1 }}>{GLYPH[role]}</span>
      <span>{label}</span>
    </span>
  )
}

/** One health verdict per device, in priority order. Stale outranks healthy:
 *  a device that has not checked in is unknown, not fine. */
export function deviceStatus(d: Device): { role: StatusRole; label: string } {
  if (isStale(d)) return { role: 'warning', label: 'stale' }
  if (d.pinned) return { role: 'serious', label: 'pinned' }
  if (!d.healthy) return { role: 'critical', label: 'unhealthy' }
  if (d.pending_commit) return { role: 'neutral', label: 'pending reboot' }
  return { role: 'good', label: 'healthy' }
}

export function DeviceStatus({ device }: { device: Device }) {
  const { role, label } = deviceStatus(device)
  return <StatusChip role={role} label={label} />
}

export function RolloutStateChip({ state }: { state: string }) {
  const map: Record<string, StatusRole> = {
    running: 'good', complete: 'good', pending: 'neutral',
    paused: 'warning', halted: 'critical',
  }
  return <StatusChip role={map[state] ?? 'neutral'} label={state} />
}
