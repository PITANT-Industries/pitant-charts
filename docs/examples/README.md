# Chart Examples

These examples are the first v1 handoff set for teams replacing SciChart inside
PITANT applications. They are docs-first examples, not a docs site. Keep them
small, typed-array based, and explicit about the current phase boundary.

For the first-run install path and the local live docs app, see
[`docs/quick-start.md`](../quick-start.md). The live docs app imports the same
registry block source that the shadcn smoke test installs.

## Example Index

| Example | Use when | Do not use when |
|---|---|---|
| [React time-series composition](react-time-series-composition.md) | A React app needs an industrial historian trend with legend, tooltip slot, streaming append, quality/gap visibility, and renderer fallback. | The consumer is not React, the chart must be driven from a retained imperative object, or the data is digital/state-lane data. |
| [React digital channel composition](react-digital-channel-composition.md) | A React app needs binary, enumerated, alarm, permissive, interlock, or equipment-state lanes. | The signal is continuous and should be interpolated as a process trend. |
| [Synchronized dashboard composition](synchronized-dashboard-composition.md) | Multiple chart panels need to share cursor or x-range state inside one tenant/site view. | The panels cross tenant, site, evidence, or authorization boundaries without explicit scope metadata. |
| [Core imperative charts](core-imperative-charts.md) | A non-React app, test harness, embedded shell, or migration adapter needs direct canvas ownership. | A React app can use `TimeSeries`, `DigitalChannel`, or concrete hooks and let React own lifecycle. |

## Performance Rules

- Use `Float64Array` and `Uint8Array` inputs. Do not feed row objects into
  render paths on every frame.
- Memoize `data` and `config` objects in React. Changing object identity tells
  the hook that it may need to re-plan.
- Use `append()` for streaming deltas. Do not replace the entire dataset for
  every historian tick.
- Keep tooltip, legend, and status overlays in DOM. Do not redraw them into the
  canvas unless they need to be part of an export artifact.
- Use `renderer="auto"` for normal apps. Force `canvas2d` only for diagnostics,
  screenshots, or known GPU-denied environments.
- Scope `ChartSyncGroup` to one tenant/site/workflow view. Sync state is user
  interaction state, not a cross-site data contract.
- Keep Phase 4 interactions labeled as pending. Current examples show the sync
  contract and manual range application, not finished zoom/crosshair behavior.

## Primitive Use Map

| Primitive | Use when | Do not use when |
|---|---|---|
| `ChartContainer` | A composed chart needs one canvas layer, one DOM overlay layer, DPR-aware sizing, and accessible role/labels. | A complete chart type already owns the container and you only need normal trend rendering. |
| `ChartCanvas` | A low-level tool needs render context lifecycle without the higher-level container/overlay composition. | You need legend, tooltip, accessibility, resize refs, or chart state from `TimeSeries`/`DigitalChannel`. |
| `ChartLegend` | Series visibility is user-controlled and must stay visible above the canvas. | The series set is fixed by a regulated report or evidence pack that cannot be changed by the viewer. |
| `ChartTooltip` | A chart has a payload and screen-space position from interaction logic. | There is no hover/crosshair source yet; keep the component mounted with `null` payload until Phase 4 fills it. |
| `ChartSyncGroup` | Multiple charts in one workflow need shared cursor/range state. | The charts represent unrelated scopes, tenants, sites, or evidence contexts. |
