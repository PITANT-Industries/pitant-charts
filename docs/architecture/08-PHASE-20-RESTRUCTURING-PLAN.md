# 08 - Phase 20 Restructuring Plan

This plan is not active yet. It is the future behavior-neutral restructuring
plan to run after v1 and productization phases expose enough surface area that
flat package structure becomes a liability.

## Why This Phase Exists

The imported code is still small enough to evolve directly. Phase 20 becomes
necessary when renderer, data, layout, interaction, export, and chart-pack code
start competing inside broad source folders and public exports become hard to
audit.

Expected symptoms:

- `packages/charts/src/index.ts` exports too many unrelated families.
- Renderer code mixes backend APIs, layout assumptions, and chart-specific
  command generation.
- React hooks hide data-engine, renderer, interaction, and export concerns in
  one file.
- Chart packs cannot tell which features are production, pilot, simulated, or
  contract-only.
- Frontend teams cannot map a component to its feature family or fixture pack.

## Non-Negotiable Invariants

- Public package export names remain stable unless a contract migration is
  approved.
- Serialization and TypeScript compatibility tests cover moved public types.
- WebGPU and Canvas2D behavior remains equivalent for shared command lists.
- Quality/gap/provenance behavior is not weakened.
- No new runtime dependencies enter `@pitant/charts` without roadmap approval.
- Benchmarks are run before and after risky movement.

## Target Architecture

```
packages/charts/src/
  data/
    ingest/
    normalize/
    transform/
  layout/
    axes/
    panels/
    lanes/
  render/
    context/
    webgpu/
    canvas2d/
    commands/
  charts/
    time-series/
    digital-channel/
    overlays/
  interact/
    gestures/
    cursor/
    selection/
  export/
  theme/
  govern/

packages/charts-react/src/
  primitives/
  hooks/
  charts/
  accessibility/
  sync/
```

## Route/Component Metadata Schema

Every public component, hook, and package export should have metadata:

- family
- stability: stable, mvp, fixture-only, contract-only
- profile gate
- package path
- export name
- mode vector
- owning module path
- fixture pack

## Per-Module Migration Plan

## Data module split

**What moves.** `data-engine`, `columnar`, `data-source`, public data types.

**From.** `packages/charts/src/data-engine`.

**To.** `packages/charts/src/data/{ingest,normalize,transform}`.

**Re-exports.** Preserve root exports and `./data-engine` subpath until a major
version migration.

**Tests.** Columnar, data source, LOD, data engine tests.

## Render module split

**What moves.** Render context, WebGPU, Canvas2D, command list, shaders.

**From.** `packages/charts/src/renderer`.

**To.** `packages/charts/src/render/{context,webgpu,canvas2d,commands}`.

**Re-exports.** Preserve `RenderContext`, `createRenderContext()`,
`RenderCommandList`.

**Tests.** Render command list, public API, browser render checks.

## React module split

**What moves.** Primitives, hooks, sync, accessibility.

**From.** `packages/charts-react/src`.

**To.** `packages/charts-react/src/{primitives,hooks,charts,accessibility,sync}`.

**Re-exports.** Preserve all root exports until next major.

**Tests.** React primitive and hook tests.

## Migration Order

1. Add component metadata types and tests.
2. Split data internals while preserving exports.
3. Split render internals while preserving exports.
4. Split React internals while preserving exports.
5. Add chart-pack folders after TimeSeries/DigitalChannel stabilize.
6. Move persistence-free export code.
7. Remove deprecated internal paths only in a major release.

## Test Gates

- `bun run lint`
- `bun run build`
- `bun run typecheck`
- `bun run test`
- `bun run bench`
- Browser render checks once available
- Public API compatibility test
- Fixture validation for frontend packs

## Phase Exit Criteria

- Every process family from `02` has a module owner.
- Every public export has metadata.
- No source file exceeds 800 lines without an exception.
- Existing package exports remain stable or have a migration note.
- Phase 21 enterprise readiness can start without first remapping ownership.
