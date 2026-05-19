# Phase 0 Baseline Report

**Date:** 2026-05-18  
**Repo:** `pitant-charts`  
**Imported source:** `/Users/ali/Pchart`

## Verification

| Command | Result | Notes |
|---|---|---|
| `bun install` | pass | lockfile refreshed by Bun 1.3.11 |
| `bun run lint` | pass | Biome checked 61 files |
| `bun run build` | pass | generated package `dist/` outputs |
| `bun run typecheck` | pass | requires build first today |
| `bun run test` | pass | 14 files, 226 tests |
| `bun run bench` | pass | 7/7 benchmark scenarios |

## Known Baseline Notes

- Typecheck and tests currently require package `dist/` output because
  `@pitant/charts-react` resolves `@pitant/charts` through package exports.
- `apps/multiaxis-demo/` is present as an untracked workspace in this checkout;
  `bun install` detected it and updated `bun.lock` with
  `@pitant/multiaxis-demo`.
- Browser render verification does not exist yet.
- Real TimeSeries and DigitalChannel chart types are not implemented yet.
- Export is canvas `toBlob()` only; true SVG/PDF export is future work.

## Current Delta

This file remains the import baseline, not the live release scorecard. The
Phase 0 gap ledger records closure. As of 2026-05-19, TimeSeries,
DigitalChannel, layout, interaction, registry, PNG/SVG export, benchmark, and
browser CI gaps are closed for the v1 release candidate. The live release
evidence is maintained in
`docs/architecture/phase-5/release-candidate-evidence.md`.
