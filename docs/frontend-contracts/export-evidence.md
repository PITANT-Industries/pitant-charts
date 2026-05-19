# Export And Evidence Contract Pack

## Workflow

Export and evidence turns chart views into reviewed artifacts: PNG, SVG, PDF,
and replay references. Primary actors are investigators, approvers, auditors,
quality reviewers, and customer-facing support engineers.

## Route Or Package API List

| Surface | Path or symbol | 06 section |
|---|---|---|
| Core export | `exportPng()` from chart hooks | Export Inventory |
| Core export | `exportSvg()` from chart hooks and command frames | Export Inventory |
| Future export | `exportPdfEvidencePack()` | Phase 6 Chart Family Use / Do Not Use Catalog |
| Sibling owner | `pitant-audit` and `pitant-compliance` evidence handoff | Whole-PITANT Composition Model |

## Request Or Prop Shape

```ts
await chart.exportEvidence({
  format: 'pdf',
  title: 'Batch deviation trend review',
  replaySpec,
  evidenceLabels,
  includeProvenance: true,
})
```

## Success State Shape

- PNG export honors explicit size, background, and pixel ratio.
- SVG export is vector command based and clipped to the plot area.
- PDF evidence export includes page numbers, provenance footer, replay spec,
  quality/gap legend, custody label, and reviewer/signature state.
- Export is blocked if required provenance or evidence labels are absent.

## Fixtures

- Success: `pdf-evidence-pack-20charts` plus existing PNG and SVG fixtures.
- Degraded: one chart has gaps, one has stale quality, and one is Canvas2D
  fallback; all states appear in the artifact.
- Denied: user lacks export, evidence-pack, or regulated-record permission.
- Validation-error: replay spec is missing, tenant/site scope is inconsistent,
  or requested format is unsupported.

## State Machine

`ready -> export-preview -> export-generating -> export-ready`

`ready -> export-denied`

`ready -> validation-error`

`export-ready -> evidence-handoff`

## Profile Gating

PNG and SVG are enabled for `workshop`, `plant`, `regulated`, `enterprise`,
and `premium`. PDF evidence is enabled only for `regulated`, `enterprise`, and
`premium` after sibling evidence handoff contracts exist.

## Mode Vector Summary

`{Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=regulated-sensitive; Liability=regulated-record}`

## Use Boundary

Use this pack when a chart becomes an artifact. Do not use PDF export for live
exploration, unsupported data, missing provenance, or workflows that require a
machine-replay package instead of page layout.
