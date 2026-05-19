# Scientific Analysis Contract Pack

## Workflow

Scientific analysis covers frequency-domain and advanced engineering views:
spectrogram, spectrum, distribution, power spectrum, Bode response, and
transfer-response comparison. Primary actors are vibration specialists,
controls engineers, power quality engineers, quality engineers, and process
engineers.

## Route Or Package API List

| Surface | Path or symbol | 06 section |
|---|---|---|
| Package API | `Spectrogram`, `useSpectrogram`, `SpectrogramChart` | Phase 6 Chart Family Use / Do Not Use Catalog |
| Package API | `Spectrum`, `useSpectrum`, `SpectrumChart` | Phase 6 Chart Family Use / Do Not Use Catalog |
| Package API | `Distribution`, `useDistribution`, `DistributionChart` | Phase 6 Chart Family Use / Do Not Use Catalog |
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

<Spectrogram
  ariaLabel="Pump vibration spectrogram"
  data={{
    timeBins,
    frequencyBins,
    values,
    timeBinWidth: 15,
    frequencyBinWidth: 2,
  }}
  config={{
    xAxis: { label: 'Seconds' },
    yAxis: { label: 'Hz' },
    zAxis: { label: 'Magnitude' },
  }}
/>

<Distribution
  ariaLabel="Frozen capability distribution"
  data={{
    binStarts,
    binEnds,
    columns: {
      count,
    },
  }}
  config={{
    series: [{ key: 'capability', label: 'Capability distribution', field: 'count' }],
    markers: [
      { key: 'lsl', kind: 'lower-spec', value: lowerSpec, label: 'LSL' },
      { key: 'target', kind: 'target', value: target, label: 'Target' },
      { key: 'usl', kind: 'upper-spec', value: upperSpec, label: 'USL' },
    ],
    xAxis: { label: engineeringUnit },
    yAxis: { label: 'Count', baseline: 0 },
  }}
/>
```

## Success State Shape

- Sampling rate, window policy, units, color scale, and tile resolution are
  visible in tooltip or legend.
- Initial Spectrum view renders precomputed frequency bins, peak labels, and
  frequency bands through the package command-frame path.
- Initial Spectrogram view renders precomputed time-frequency tiles through the
  package command-frame path.
- Initial Distribution view renders precomputed bins and spec/target/percentile
  markers through the package command-frame path.
- Spectrogram labels must make upstream STFT/window/sample-rate provenance
  visible before fault-signature conclusions are trusted.
- Spectrum view labels must make the upstream window/sample-rate provenance
  visible before band-power or harmonic conclusions are trusted.
- Bode view shows gain, phase, confidence, and invalid-pair states.

## Fixtures

- Success: `spectrum-1m-window` renders through benchmark
  `026_spectrum_1m_window_64k_bins` and render-harness profile `spectrum`.
- Success: `spectrogram-tiles-60m` renders through benchmark
  `027_spectrogram_60m_64k_tiles` and render-harness profile `spectrogram`.
- Success: `distribution-panel-1m` renders through benchmark
  `028_distribution_1m_window_512_bins` and render-harness profile
  `distribution`.
- Future success: `bode-response-fixture` renders within its declared benchmark
  profile.
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

Initial Spectrum, Spectrogram, and Distribution are enabled for `plant`,
`enterprise`, and `premium` deployments when upstream analytics provides frozen
frequency bins, time-frequency tiles, or distribution bins. Bode remains hidden
until its fixture moves beyond `contract_only`.

## Mode Vector Summary

`{Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=assisted; Privacy=telemetry-only; Liability=engineering-review}`

## Use Boundary

Use this pack when frequency-domain or frozen-distribution inspection answers
the user's question and the upstream window, sampling rate, units, or bin
boundaries are known. Do not use it when a trend, event marker, SPC view, or
correlation surface is the more direct representation, or when the chart
package would have to become the authoritative FFT/STFT/statistics engine.
