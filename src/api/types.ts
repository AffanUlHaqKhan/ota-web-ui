// Mirrors ota-server/api/main.py. Once the server is real, generate these from
// its /openapi.json instead of hand-maintaining them -- hand-written API types
// drift silently.

export type DeviceUpdateState =
  | 'idle' | 'offered' | 'downloading' | 'pending_reboot' | 'confirming'

export type InstallResult =
  | 'success' | 'download_failed' | 'deploy_failed' | 'healthcheck_failed' | 'rollback'

export interface Device {
  id: string
  group: string
  branch: string
  hardware_id: string
  /** Commit the device is actually running. */
  booted_commit: string
  /** Deployed but not yet rebooted into. Never conflate with booted_commit. */
  pending_commit: string | null
  app_version: string
  healthy: boolean
  /** ISO timestamp. Absence of news is not good news -- see isStale(). */
  last_seen: string
  update_state: DeviceUpdateState
  pinned: boolean
  pin_reason: string | null
}

export interface Target {
  branch: string
  commit: string
  version: string
  size_bytes: number
  /** Size of the static delta from the previous release; null if none exists. */
  delta_bytes: number | null
  created_at: string
  created_by: string
}

export type RolloutState = 'pending' | 'running' | 'paused' | 'complete' | 'halted'
export type RolloutStrategy = 'canary' | 'staged' | 'all'

export interface RolloutCounts {
  offered: number
  downloading: number
  pending_reboot: number
  confirmed: number
  failed: number
  rolled_back: number
  /** In the group but not yet in an active wave. */
  waiting: number
}

export interface Rollout {
  id: string
  branch: string
  version: string
  commit: string
  group: string
  strategy: RolloutStrategy
  state: RolloutState
  waves: number[]
  current_wave: number
  halt_on_failure_pct: number
  created_at: string
  counts: RolloutCounts
  /** Set when the server auto-halted, e.g. "failure rate 7% exceeded 5%". */
  halt_reason: string | null
}

export interface DeviceEvent {
  ts: string
  device_id: string
  kind: string
  detail: string
  result?: InstallResult
}

export interface FleetResponse {
  devices: Device[]
  total: number
}

export interface Api {
  fleet(): Promise<FleetResponse>
  device(id: string): Promise<Device>
  deviceEvents(id: string): Promise<DeviceEvent[]>
  setPinned(id: string, pinned: boolean): Promise<void>
  targets(): Promise<Target[]>
  rollouts(): Promise<Rollout[]>
  rollout(id: string): Promise<Rollout>
  rolloutDevices(id: string): Promise<Device[]>
  createRollout(input: {
    branch: string; version: string; commit: string; group: string
    strategy: RolloutStrategy; halt_on_failure_pct: number
  }): Promise<Rollout>
  pauseRollout(id: string): Promise<Rollout>
  resumeRollout(id: string): Promise<Rollout>
}

/** A device that has not checked in is unknown, not healthy. */
export function isStale(d: Device, pollIntervalS = 300): boolean {
  return Date.now() - new Date(d.last_seen).getTime() > pollIntervalS * 2 * 1000
}

export function shortCommit(c: string | null): string {
  return c ? c.slice(0, 10) : '—'
}

export function formatBytes(n: number | null): string {
  if (n === null) return '—'
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
