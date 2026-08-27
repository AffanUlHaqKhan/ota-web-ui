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

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
```

**Switch between mock and live data in the UI** — top of the sidebar. The choice
persists in `localStorage`, so it survives reloads; `VITE_USE_MOCK` only decides
what a fresh browser opens on. Switching clears the query cache, because the two
sources are different worlds and one's rows must never linger while the other
loads.

In **Live** mode the sidebar also reports whether `ota-server` is actually
reachable. That matters more than it sounds: an empty fleet table and a dead
server look identical, and only one of them is your problem.

**It runs with no backend and no hardware.** In **Mock** mode the app serves
itself from an in-memory fake fleet
([src/api/mock.ts](src/api/mock.ts)): 420 devices, a rollout that advances on a
timer, ~8% of devices failing their healthcheck and rolling back, and the
auto-halt threshold firing for real when the failure rate is exceeded.

That is deliberate. The fake exists so the UI is built against a realistic device
count from day one — a fleet view designed against three rows is unusable at
three thousand — and so pause/resume and auto-halt are exercised rather than
mocked as static screenshots.

To share the mock UI as static files (no Node, no backend):

```bash
npm run build:demo && npm run preview
```

Plain `npm run build` produces a **real-API** bundle — Vite only reads
`.env.development` in dev mode, so a normal production build has
`VITE_USE_MOCK` undefined and talks to `/api/v1`.

Point it at a real server with `VITE_USE_MOCK=0`; `vite.config.ts` proxies
`/api` to `http://localhost:8000`. The two implementations sit behind one
`Api` interface in [src/api/types.ts](src/api/types.ts), so nothing else changes.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Build | Vite 5 + React 18 + TS | Vite 7 needs Node 20+; this repo targets the Node 18 currently installed |
| Data fetching | `@tanstack/react-query` | caching, retries, background refetch for a dashboard that is mostly reads |
| Live updates | polling every 2s, **placeholder** | `WS /api/v1/events` does not exist server-side yet; polling a fleet endpoint does not scale past a few hundred devices |
| Types | hand-written in `src/api/types.ts` | generate from `/openapi.json` once the server is real — hand-written types drift |
| Auth | not implemented | needs the IdP decision, `DECISIONS.md` D11 |

## Layout

```
src/
  api/        types.ts (contract) · client.ts (real) · mock.ts (fake fleet) · index.ts (switch)
  components/ Status.tsx (chips) · RolloutProgress.tsx (segmented breakdown)
  pages/      Fleet · DeviceDetail · Targets · Rollouts · RolloutDetail
  theme.css   design tokens, light + dark
```

## Design notes

Colours follow a validated palette. Two rules are load-bearing:

- **Status is never colour alone.** Every chip is colour + glyph + word. On a
  light surface `warning` and `serious` sit below 3:1 contrast by design, and
  the label is the mitigation — don't strip it to save space.
- **The rollout bar is segmented, never one percentage.** In-flight stages use a
  sequential blue ramp (light = earlier); terminal outcomes use reserved status
  colours. Counts appear as numbers beside the legend, and the failure rate is
  stated in words underneath.

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

## Not built yet

- **Auth.** No login, no OIDC, no roles. `DECISIONS.md` D11.
- **Settings screen.** Groups, channels, maintenance windows, tokens.
- **Create-rollout form.** The API method exists (`createRollout`); no UI yet.
  When built, it must state the blast radius — "Roll out v1.2.3 to production
  (4,182 devices)" — before it will submit.
- **WebSocket live updates.** Polling is a placeholder, see the table above.
- **Server-side pagination.** The fleet table caps at 200 rows client-side; the
  real endpoint needs to paginate.
