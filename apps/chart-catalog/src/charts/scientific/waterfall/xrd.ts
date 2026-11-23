import type { SpectralWaterfallAxes, SpectralWaterfallData } from './model'
import measurements from './xrd-measurements.json'

// Adeel Zafar (2025), Harvard Dataverse V1, DOI 10.7910/DVN/ACPWBG, CC0 1.0.
// From DyNiC2_XRD/integration, sort by the measured temperature in each .chi header.
// Keep every fourth scan and the final scan, with all original bins from 5° to 5.5°.
export const xrdWaterfall = {
  data: {
    spectralBins: measurements.spectralBins,
    scanValues: measurements.scanValues,
    values: measurements.intensityRows.flat(),
  } satisfies SpectralWaterfallData,
  axes: {
    spectral: { label: 'Diffraction angle 2θ', unit: '°' },
    scan: { label: 'Temperature', unit: 'K' },
    intensity: { label: 'Diffracted intensity', unit: 'a.u.' },
  } satisfies SpectralWaterfallAxes,
  source: {
    label: 'Adeel Zafar, Harvard Dataverse (CC0 1.0)',
    href: 'https://doi.org/10.7910/DVN/ACPWBG',
  },
  description: 'Synchrotron X-ray diffraction of DyNiC₂ across 16 measured temperatures from 10.91 to 294.11 K. The chart shows the original intensities in the 5° to 5.5° diffraction window. The source reports intensity without calibrated units.',
}
