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
| Package API | `Spectrum`, `useSpectrum`, `SpectrumChart` | Phase 6 Chart Family Use / Do Not Use Catalog |
| Future chart | `BodeChart` | Phase 6 Chart Family Use / Do Not Use Catalog |
| Future transform | `spectrogram tile generation` | Transform Inventory |

## Request Or Prop Shape

```ts
<Spectrum
  ariaLabel="Pump vibration spectrum"
  data={{
    frequencies,
    columns: {
      magnitude,
    },
  }}
  config={{
    series: [{ key: 'vibration-spectrum', label: 'Vibration spectrum', field: 'magnitude' }],
    peakMarkers: [{ key: 'bpfo', frequency: 73, magnitude: 50, label: 'BPFO' }],
    bands: [{ key: 'bearing', frequencyStart: 68, frequencyEnd: 78 }],
    xAxis: { label: 'Hz' },
    yAxis: { label: 'Magnitude', baseline: 0 },
  }}
/>
```

## Success State Shape

- Sampling rate, window policy, units, color scale, and tile resolution are
  visible in tooltip or legend.
- Initial Spectrum view renders precomputed frequency bins, peak labels, and
  frequency bands through the package command-frame path.
- Spectrogram tiles later pan and zoom on the same time axis as linked trends.
- Spectrum view labels must make the upstream window/sample-rate provenance
  visible before band-power or harmonic conclusions are trusted.
- Bode view shows gain, phase, confidence, and invalid-pair states.

## Fixtures

- Success: `spectrum-1m-window` renders through benchmark
  `026_spectrum_1m_window_64k_bins` and render-harness profile `spectrum`.
- Future success: `spectrogram-tiles-60m` and `bode-response-fixture` render
  within their declared benchmark profiles.
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

Initial Spectrum is enabled for `plant`, `enterprise`, and `premium`
deployments when upstream analytics provides frozen frequency bins. Spectrogram
and Bode remain hidden until their fixtures move beyond `contract_only`.

## Mode Vector Summary

`{Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=assisted; Privacy=telemetry-only; Liability=engineering-review}`

## Use Boundary

Use this pack when frequency-domain inspection answers the user's question and
the upstream window, sampling rate, and units are known. Do not use it when a
trend, event marker, SPC view, or correlation surface is the more direct
representation, or when the chart package would have to become the authoritative
FFT/STFT engine.
