# PITANT Charts Registry

This folder contains the first shadcn-compatible registry blocks for
`@pitant/charts` and `@pitant/charts-react`.

## Items

| Item | Target |
|---|---|
| `pitant-time-series` | `@components/pitant/time-series.tsx` |
| `pitant-digital-channel` | `@components/pitant/digital-channel.tsx` |
| `pitant-synchronized-dashboard` | `@components/pitant/synchronized-dashboard.tsx` |
| `pitant-datazoom` | `@components/pitant/datazoom.tsx` |
| `pitant-streaming-trend` | `@components/pitant/streaming-trend.tsx` |
| `pitant-multi-axis` | `@components/pitant/multi-axis.tsx` |
| `pitant-export` | `@components/pitant/export.tsx` |
| `pitant-dashboard-overview` | `@components/pitant/dashboard-overview.tsx` |

## Validation

Run:

```sh
bun run registry:validate
bun run registry:typecheck
bun run registry:smoke
```

The validator checks the root registry metadata and file references. The
typecheck gate verifies the block source against the public package types.
The smoke gate runs the real `shadcn` CLI against a fresh Vite consumer app.
Because the PITANT packages are not published yet, the smoke test builds the
registry in `/tmp`, dry-runs the public dependency form, then patches only the
temporary registry items to install local package tarballs before typechecking
and building the consumer.

## Install Contract

Each block is a client component and assumes the host app already has React.
The registry item installs `@pitant/charts` and `@pitant/charts-react`.

Import chart tokens once in the host app when PITANT defaults should override
the built-in CSS variable fallbacks:

```ts
import '@pitant/charts/styles/tokens.css'
```
