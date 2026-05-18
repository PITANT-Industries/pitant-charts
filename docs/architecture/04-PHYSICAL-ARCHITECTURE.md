# 04 - Physical Architecture

## Same-Binary Principle

`pitant-charts` ships as the same core package and React package across every
deployment. Workshop, plant, regulated, and fleet deployments differ by browser
capabilities, bundle policy, profile gates, worker budgets, and upstream data
contracts. They do not fork the library.

## Logical Components

| Component | Role | Stateful? | Scales by |
|---|---|---|---|
| Core package | Data engine, render contexts, transforms, tokens | In-memory only | Bundle splitting, worker count |
| React package | Primitives, hooks, sync group, accessibility | View-local state | Component instances |
| Data worker | LOD build/query, append path, future derived visual data | In-memory | One per chart or shared worker pool |
| WebGPU renderer | Primary high-density draw backend | GPU resources | GPU/device limits, command batching |
| Canvas2D renderer | Fallback draw backend | Canvas resources | Point budgets and batching |
| Layout engine | Axes, panels, labels, lanes | View-local state | Chart panels |
| Interaction engine | Pointer/keyboard/touch state | View-local state | Event stream and chart count |
| Export engine | PNG/SVG/PDF/replay spec | Temporary buffers | Artifact size and vector complexity |
| Benchmark app | Synthetic and fixture performance validation | Baseline JSON | Scenario count and browser matrix |
| Registry/docs | shadcn blocks, examples, migration notes | Static files | CDN/docs hosting |

## Tier T0 - Workshop (single browser, local/offline)

**Profile.** Single device, single operator, small machine or lab. Typical load:
1-20 charts, 1-8 series each, 1k-100k points per series.

**Topology.**

```
local app bundle
  ├─ @pitant/charts-react
  ├─ @pitant/charts
  ├─ data worker
  └─ Canvas2D or WebGPU canvas
```

**Sizing.** 2-4 CPU cores, 8 GB RAM, integrated GPU acceptable, browser memory
budget under 512 MB for chart surfaces.

**High availability.** None. Reload reconstructs view from local app state.

**Backup target.** Exported replay specs and screenshots saved locally.

**Network and zones.** No cloud dependency. Data is passed in by local app or
fixture.

**Constraints / what breaks.** Does not survive browser crash unless app saves
view state. Not suitable for regulated evidence without upstream signatures.

## Tier T1 - Plant Dashboard

**Profile.** Control room or engineering dashboard with historian data. Typical
load: 4-16 synchronized panels, 8-64 visible series, 100k-1M points per series
after LOD.

**Topology.**

```
pitant-web / pitant-client
  ├─ generated historian client
  ├─ @pitant/charts-react
  │   └─ sync groups
  └─ @pitant/charts
      ├─ shared data workers
      └─ WebGPU renderer + Canvas2D fallback
```

**Sizing.** Modern workstation, 8-16 CPU cores, 16-32 GB RAM, discrete GPU
preferred. Chart memory budget under 1 GB per dashboard session.

**High availability.** Browser reload plus upstream historian HA. Chart state is
serializable.

**Backup target.** Saved views in app state, exported PNG/SVG and replay specs.

**Network and zones.** Browser in IT or control-room zone. Data crosses only
through approved `pitant-web`/historian APIs.

**Constraints / what breaks.** WebGPU loss falls back to Canvas2D with reduced
point budgets and visible performance warning.

## Tier T2 - Regulated Site Review

**Profile.** GMP, quality, incident, or safety-supporting investigation. Typical
load: lower chart count but stronger evidence and export requirements.

**Topology.**

```
regulated app profile
  ├─ identity and audit context
  ├─ signed historian query result
  ├─ @pitant/charts replayable view state
  └─ export engine with evidence labels
```

**Sizing.** Workstation or validated browser environment. Memory budget under
1 GB with explicit export buffer limits.

**High availability.** Upstream app/historian owns availability. This package
must preserve deterministic replay data.

**Backup target.** Signed export manifest, replay spec, data slice hash, and
audit linkage.

**Network and zones.** Tenant/site/zone context required on data and exports.

**Constraints / what breaks.** Cannot claim regulated evidence if upstream data
is unsigned or quality/gap labels are unavailable.

## Tier T3 - Enterprise/Fleet Dashboard

**Profile.** Many sites and many simultaneous dashboards. Typical load:
hundreds of chart instances across users, but each browser session keeps bounded
local budgets.

**Topology.**

```
fleet web shell
  ├─ federated data APIs
  ├─ chart bundle loaded per route
  ├─ shared workers per dashboard
  └─ per-site scoped sync groups
```

**Sizing.** Browser-session budget remains the same as T1/T2. Server-side
scaling belongs to sibling repos and CDN/package hosting.

**High availability.** CDN/package availability plus upstream app HA.

**Backup target.** Saved views, chart specs, and evidence exports stored by app
or compliance repo.

**Network and zones.** Cross-site charting uses federated-summary data unless a
user has explicit site data access.

**Constraints / what breaks.** Raw cross-site data movement is not a chart
package concern; it must be handled by federation and historian contracts.

## Tier Transitions

T0 to T1 requires moving from local fixtures to contracted historian payloads.
T1 to T2 requires signed upstream data, visible degraded states, and export
manifest support. T2 to T3 requires tenant/site/federation metadata and saved
view compatibility. All transitions are package upgrades plus app profile
changes; no data migration is owned here.

## Components Not In This Repo

| Deployment piece | Owning repo |
|---|---|
| Historian query service | `pitant-historian` |
| Event transport | `pitant-streams` |
| Device collection | `pitant-fieldlink` |
| Identity and policy | `pitant-identity` |
| App shell and routing | `pitant-web`, `pitant-client`, `pitant-mobile` |
| HMI command boundary | `pitant-hmi-sdk` |
| Compliance evidence room | `pitant-compliance`, `pitant-audit` |
| Deployment manifests | `pitant-deploy` |
