# ota-web-ui

Operator dashboard for `ota-server`. Runs in a browser, used by whoever is responsible for the
fleet.

Not the device screen — that is `HomeAutomationGUI`. Different users, different auth,
different repo.

---

## What this UI is for

One job: **let a human safely push new software to real devices, and stop it when it goes
wrong.**

Everything else — pretty charts, historical analytics, device inventory management — is
secondary and can wait. If the UI does not make "abort this rollout" instant and obvious, it
has failed at the only thing that matters at 3am.

---

## Screens

### Fleet
Device table: id, group, **booted** commit + version, **pending** commit, last seen, health,
update state. Filters: branch, group, version, stale (`last_seen > 2 × poll interval`),
unhealthy, pinned.

The default view should answer "is anything wrong right now" without clicking.

### Device detail
Install history, current and previous deployment, event log, current rollout membership.
Actions: pin/unpin, force check, decommission.

Pinned devices need a visible reason — most pins are automatic, set by the server after a
rollback, and an operator seeing "pinned" without "why" will just unpin it.

### Builds (targets)
Per branch: commit, version, size, delta size against the previous release, who published it,
when. Action: promote to a channel.

Show **delta size**, not just image size. It is what devices actually download and the number
that reveals a broken reproducible build (a delta near full-image size means something
regressed in `meta-ota-platform`).

### Rollouts
Create: target + group + strategy + thresholds. Live list with progress per wave.

Progress must be broken down, never a single percentage:

```
offered   842   downloading  61   pending reboot  118   confirmed  640   failed  12   rolled back  3
```

A single "73% complete" bar hides the only two numbers that matter — failed and rolled back.

### Rollout detail
Per-device outcome, failures grouped by reason, live event stream. Prominent, always-visible
**Pause** button.

### Settings
Groups, channels, maintenance windows, API tokens, operators and roles.

---

## Non-negotiable UX rules

- **Abort is one click, always reachable, no confirmation dialog buried three levels deep.**
  Pausing a rollout is safe and reversible; making it slow is not.
- **Failure rate and rollback count are shown during the rollout**, not in a report afterwards.
- **Booted commit ≠ pending commit.** A device that downloaded but has not rebooted is not
  updated. Conflating them makes a rollout look finished when half the fleet has not applied it.
- **Never upload firmware from the browser.** CI publishes targets; the UI selects among them.
  An artifact that reached devices without passing CI is unsignable and untraceable.
- **Production rollouts require an explicit confirmation naming the group and device count.**
  "Roll out v1.2.3 to production (4,182 devices)" — typing or clicking through something that
  states the blast radius.
- **Stale devices are not healthy devices.** A device that has not checked in is unknown, and
  the UI must show it as unknown, not green.

---

## Stack

Scaffold fresh so dependencies are current:

```bash
npm create vite@latest . -- --template react-ts
npm i @tanstack/react-query react-router-dom
```

| Concern | Choice | Why |
|---|---|---|
| Data fetching | `@tanstack/react-query` | caching, retries, background refetch for a dashboard that is mostly reads |
| Live updates | `WS /api/v1/events` | polling a fleet endpoint every few seconds does not scale past a few hundred devices |
| Types | generate from `/openapi.json` | hand-written API types drift silently; FastAPI already publishes the schema |
| Auth | OIDC → bearer token | same IdP as the operator API |
| Charts | add only when a chart answers a real question | most of this UI is tables |

Framework preference is low-stakes (`DECISIONS.md` D11). Auth and the role model are not.

---

## Auth

Operator auth is **completely separate** from device auth. Devices use mTLS client certs; the
browser never sees one and must never be issued one.

Roles worth having from the start:

| Role | Can |
|---|---|
| viewer | read fleet, builds, rollouts |
| operator | create/pause rollouts on non-production groups, pin devices |
| release manager | promote to production |

Enforcement belongs on the server. The UI hides buttons; that is a convenience, not a control.

---

## Development

```bash
npm run dev
```

Proxy the API in `vite.config.ts`:

```ts
server: {
  proxy: {
    '/api': { target: 'http://localhost:8000', changeOrigin: true },
    '/ws':  { target: 'ws://localhost:8000', ws: true },
  },
}
```

Run `ota-server`'s compose stack alongside. Seed it with fake devices — a fleet view built and
tested against three rows will be unusable at three thousand. Test with pagination, sorting and
filtering against a realistic device count from day one.

---

## Layout

```
src/
  api/          generated client + react-query hooks
  pages/        Fleet, DeviceDetail, Targets, Rollouts, RolloutDetail, Settings
  components/   tables, status chips, progress breakdown
  auth/         OIDC integration
public/
docs/
```
