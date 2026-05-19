# Phase 5 Artifacts

Phase 5 turns `pitant-charts` into a v1 local release candidate: installable
packages, registry blocks, docs, export paths, performance gates, and release
evidence.

| File | Purpose |
|---|---|
| [release-candidate-evidence.md](release-candidate-evidence.md) | Local v1 evidence for package dry-run, publish dry-run, registry smoke, browser matrix, and remaining external gates |

## Closure Rule

Phase 5 is locally complete when `release:check`, `registry:smoke`, npm
publish dry-run, and local browser smoke evidence pass. It is externally
complete only after the workflow files are committed and pushed, GitHub CI
passes, and the publish workflow is dispatched with `dry_run=true`.

## Current State

- Local release candidate: complete.
- PR CI matrix: passed on
  https://github.com/PITANT-Industries/pitant-charts/actions/runs/26089639951.
- Remaining external evidence: publish workflow dry-run after
  `.github/workflows/publish.yml` exists on the default branch.
