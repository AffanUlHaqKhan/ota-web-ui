// Real ota-server client. Operator routes only -- device routes use mTLS and the
// browser must never hold a device credential.
import type {
  Api, Device, DeviceEvent, FleetResponse, Rollout, Target,
} from './types'

const BASE = '/api/v1'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      // TODO: OIDC bearer token once the IdP is chosen (DECISIONS.md D11).
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${init?.method ?? 'GET'} ${path} -> ${res.status} ${body}`.trim())
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export const httpApi: Api = {
  fleet: () => req<FleetResponse>('/fleet'),
  device: id => req<Device>(`/devices/${id}`),
  deviceEvents: id => req<DeviceEvent[]>(`/devices/${id}/events`),
  setPinned: (id, pinned) =>
    req<void>(`/devices/${id}/pin`, { method: 'POST', body: JSON.stringify({ pinned }) }),
  targets: () => req<Target[]>('/targets'),
  rollouts: () => req<Rollout[]>('/rollouts'),
  rollout: id => req<Rollout>(`/rollouts/${id}`),
  rolloutDevices: id => req<Device[]>(`/rollouts/${id}/devices`),
  createRollout: input =>
    req<Rollout>('/rollouts', { method: 'POST', body: JSON.stringify(input) }),
  pauseRollout: id => req<Rollout>(`/rollouts/${id}/pause`, { method: 'POST' }),
  resumeRollout: id => req<Rollout>(`/rollouts/${id}/resume`, { method: 'POST' }),
}
