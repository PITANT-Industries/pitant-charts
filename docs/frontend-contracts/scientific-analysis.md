# Scientific Analysis Contract Pack

## Workflow

Scientific analysis covers frequency-domain and advanced engineering views:
spectrogram, spectrum, power spectrum, Bode response, and transfer-response
comparison. Primary actors are vibration specialists, controls engineers, power
quality engineers, and process engineers.

## Route Or Package API List

| Surface | Path or symbol | 06 section |
|---|---|---|
| Future chart | `Spectrogram` | Phase 6 Chart Family Use / Do Not Use Catalog |
| Future chart | `SpectrumChart` | Phase 6 Chart Family Use / Do Not Use Catalog |
| Future chart | `BodeChart` | Phase 6 Chart Family Use / Do Not Use Catalog |
| Future transform | `spectrogram tile generation` | Transform Inventory |

## Request Or Prop Shape

```ts
<Spectrogram
  ariaLabel="Pump vibration spectrogram"
  tiles={spectrogramTiles}
  samplingRateHz={samplingRateHz}
  windowPolicy={windowPolicy}
  colorScale={colorScale}
/>
```

## Success State Shape

- Sampling rate, window policy, units, color scale, and tile resolution are
  visible in tooltip or legend.
- Spectrogram tiles pan and zoom on the same time axis as linked trends.
- Spectrum view shows peak labels, harmonic bands, and band-power summaries.
- Bode view shows gain, phase, confidence, and invalid-pair states.

## Fixtures

- Success: `spectrogram-tiles-60m`, `spectrum-1m-window`, and
  `bode-response-fixture` render within their declared benchmark profile.
- Degraded: irregular cadence, missing sampling-rate metadata, or low
  confidence appears as a visible degraded state.
- Denied: profile or tenant disables specialist scientific analysis.
- Validation-error: tile frequency bins, time bounds, or units are inconsistent.

## State Machine

`loading -> ready -> linked-trend-ready`

`loading -> degraded`

`loading -> denied`

`loading -> validation-error`

## Profile Gating

Enabled for `enterprise`, `premium`, and profile-specific `plant` deployments.
Hidden from default daily trend workflows.

## Mode Vector Summary

`{Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=assisted; Privacy=telemetry-only; Liability=engineering-review}`

## Use Boundary

Use this pack when frequency-domain inspection answers the user's question. Do
not use it when a trend, event marker, SPC view, or correlation surface is the
more direct representation.
