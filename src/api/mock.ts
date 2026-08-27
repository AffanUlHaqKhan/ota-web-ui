// In-memory fake fleet.
//
// Exists so the dashboard is developable and demoable with no backend and no
// hardware, and -- more usefully -- so it is built against a realistic device
// count from day one. A fleet view designed against three rows is unusable at
// three thousand.
//
// The rollout advances on a timer, so pause/resume and the auto-halt threshold
// are exercised for real rather than mocked as static screenshots.

import type {
  Api, Device, DeviceEvent, FleetResponse, Rollout, RolloutState, Target,
} from './types'

const DEVICE_COUNT = 420
const BRANCH = 'raspberrypi4-64-main'

function rngFactory(seed: number) {
  // Deterministic, so reloads give the same fleet and screenshots are stable.
  let s = seed
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
}
const rand = rngFactory(42)

const hex = (n: number) =>
  Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(rand() * 16)]).join('')

const COMMIT_OLD = hex(64)
const COMMIT_NEW = hex(64)

const now = () => new Date().toISOString()
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

let devices: Device[] = Array.from({ length: DEVICE_COUNT }, (_, i) => {
  const group = i < 20 ? 'canary' : i < 400 ? 'production' : 'lab'
  // A handful of deliberately awkward devices: stale, unhealthy, pinned.
  const stale = i % 97 === 0
  const unhealthy = i % 61 === 0
  return {
    id: `rpi4-${String(i).padStart(4, '0')}`,
    group,
    branch: BRANCH,
    hardware_id: 'raspberrypi4-64',
    booted_commit: COMMIT_OLD,
    pending_commit: null,
    app_version: '1.0.0',
    healthy: !unhealthy,
    last_seen: stale ? minutesAgo(180) : minutesAgo(Math.floor(rand() * 5)),
    update_state: 'idle',
    pinned: i % 137 === 0,
    pin_reason: i % 137 === 0 ? 'rolled back from 1.1.0' : null,
  } satisfies Device
})

const targets: Target[] = [
  {
    branch: BRANCH, commit: COMMIT_NEW, version: '1.1.0',
    size_bytes: 268_435_456, delta_bytes: 14_680_064,
    created_at: minutesAgo(90), created_by: 'ci',
  },
  {
    branch: BRANCH, commit: COMMIT_OLD, version: '1.0.0',
    size_bytes: 264_241_152, delta_bytes: null,
    created_at: minutesAgo(60 * 24 * 9), created_by: 'ci',
  },
]

const events: DeviceEvent[] = []
function logEvent(device_id: string, kind: string, detail: string, result?: DeviceEvent['result']) {
  events.unshift({ ts: now(), device_id, kind, detail, result })
  if (events.length > 800) events.pop()
}

let rollouts: Rollout[] = [{
  id: 'rollout-1',
  branch: BRANCH, version: '1.1.0', commit: COMMIT_NEW,
  group: 'canary', strategy: 'canary', state: 'running',
  waves: [20], current_wave: 0, halt_on_failure_pct: 5,
  created_at: minutesAgo(12), halt_reason: null,
  counts: { waiting: 20, offered: 0, downloading: 0, pending_reboot: 0, confirmed: 0, failed: 0, rolled_back: 0 },
}]

function membersOf(r: Rollout): Device[] {
  return devices.filter(d => d.group === r.group && d.branch === r.branch)
}

function recount(r: Rollout) {
  const m = membersOf(r)
  const c = { waiting: 0, offered: 0, downloading: 0, pending_reboot: 0, confirmed: 0, failed: 0, rolled_back: 0 }
  for (const d of m) {
    if (d.booted_commit === r.commit) c.confirmed++
    else if (d.pinned && d.pin_reason?.includes('rolled back')) c.rolled_back++
    else if (d.update_state === 'pending_reboot') c.pending_reboot++
    else if (d.update_state === 'downloading') c.downloading++
    else if (d.update_state === 'offered') c.offered++
    else c.waiting++
  }
  r.counts = c
}

/** Advance one device one step. Called on a timer while a rollout runs. */
function tick() {
  for (const r of rollouts) {
    if (r.state !== 'running') continue
    const m = membersOf(r).filter(d => !d.pinned)

    // Auto-halt before doing more damage. This is the behaviour the UI exists
    // to make visible, so the fake implements it rather than faking the number.
    const attempted = r.counts.confirmed + r.counts.failed + r.counts.rolled_back
    const bad = r.counts.failed + r.counts.rolled_back
    if (attempted >= 5 && (bad / attempted) * 100 > r.halt_on_failure_pct) {
      r.state = 'halted'
      r.halt_reason =
        `failure rate ${((bad / attempted) * 100).toFixed(1)}% exceeded ${r.halt_on_failure_pct}%`
      continue
    }

    const next = m.find(d => d.booted_commit !== r.commit && d.update_state === 'idle')
      ?? m.find(d => d.update_state === 'offered')
      ?? m.find(d => d.update_state === 'downloading')
      ?? m.find(d => d.update_state === 'pending_reboot')
    if (!next) { r.state = 'complete'; recount(r); continue }

    switch (next.update_state) {
      case 'idle':
        next.update_state = 'offered'
        logEvent(next.id, 'offer', `offered ${r.version}`)
        break
      case 'offered':
        next.update_state = 'downloading'
        break
      case 'downloading':
        next.update_state = 'pending_reboot'
        next.pending_commit = r.commit
        break
      case 'pending_reboot': {
        // ~8% of devices fail their healthcheck and roll back.
        const failed = rand() < 0.08
        if (failed) {
          next.update_state = 'idle'
          next.pending_commit = null
          next.pinned = true
          next.pin_reason = `rolled back from ${r.version}`
          next.healthy = false
          logEvent(next.id, 'report', `healthcheck failed, rolled back`, 'rollback')
        } else {
          next.booted_commit = r.commit
          next.pending_commit = null
          next.app_version = r.version
          next.update_state = 'idle'
          next.healthy = true
          logEvent(next.id, 'report', `updated to ${r.version}`, 'success')
        }
        next.last_seen = now()
        break
      }
    }
    recount(r)
  }
}
setInterval(tick, 900)
rollouts.forEach(recount)

const delay = <T,>(v: T): Promise<T> =>
  new Promise(res => setTimeout(() => res(structuredClone(v)), 120))

export const mockApi: Api = {
  fleet: () => delay<FleetResponse>({ devices, total: devices.length }),
  device: id => {
    const d = devices.find(x => x.id === id)
    if (!d) return Promise.reject(new Error(`no such device: ${id}`))
    return delay(d)
  },
  deviceEvents: id => delay(events.filter(e => e.device_id === id).slice(0, 50)),
  setPinned: (id, pinned) => {
    const d = devices.find(x => x.id === id)
    if (d) { d.pinned = pinned; if (!pinned) d.pin_reason = null }
    return delay(undefined as void)
  },
  targets: () => delay(targets),
  rollouts: () => delay(rollouts),
  rollout: id => {
    const r = rollouts.find(x => x.id === id)
    if (!r) return Promise.reject(new Error(`no such rollout: ${id}`))
    return delay(r)
  },
  rolloutDevices: id => {
    const r = rollouts.find(x => x.id === id)
    return delay(r ? membersOf(r) : [])
  },
  createRollout: input => {
    const r: Rollout = {
      id: `rollout-${rollouts.length + 1}`,
      ...input, state: 'running' as RolloutState,
      waves: input.strategy === 'staged' ? [5, 25, 100] : [100],
      current_wave: 0, created_at: now(), halt_reason: null,
      counts: { waiting: 0, offered: 0, downloading: 0, pending_reboot: 0, confirmed: 0, failed: 0, rolled_back: 0 },
    }
    recount(r)
    rollouts = [r, ...rollouts]
    return delay(r)
  },
  pauseRollout: id => {
    const r = rollouts.find(x => x.id === id)!
    r.state = 'paused'
    return delay(r)
  },
  resumeRollout: id => {
    const r = rollouts.find(x => x.id === id)!
    r.state = 'running'; r.halt_reason = null
    return delay(r)
  },
}
