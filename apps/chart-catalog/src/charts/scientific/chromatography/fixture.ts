import type { ChromatogramData } from './model'
import { measuredSamples } from './measured-samples'

export const measuredChromatogram: ChromatogramData = {
  samples: measuredSamples,
  timeUnit: 'min',
  signalUnit: 'source units',
  // Manual demonstration intervals. The endpoints are native acquisition times.
  peaks: [
    { id: 'peak-1', label: 'Peak 1', start: 13.2, end: 14.33333333 },
    { id: 'peak-2', label: 'Peak 2', start: 14.49333333, end: 15.94666667 },
    { id: 'peak-3', label: 'Peak 3', start: 16.36666667, end: 17.62 },
    { id: 'peak-4', label: 'Peak 4', start: 18.36, end: 19.48666667 },
    { id: 'peak-5', label: 'Peak 5', start: 19.48666667, end: 19.96 },
    { id: 'peak-6', label: 'Peak 6', start: 19.96, end: 20.98666667 },
  ],
}

export const measuredChromatogramInitialPeak = 'peak-5'

export const measuredChromatogramSource = {
  label: 'Coffee LC–DAD dataset',
  href: 'https://doi.org/10.5281/zenodo.5412345',
  description: 'The first measured coffee injection at 225 nm, with 1,501 original readings from 12 to 22 minutes. The dataset leaves the detector scale unspecified. The integration windows are demonstration choices.',
  references: [
    { label: 'Erny, Moeenfard, and Alves (2021)', href: 'https://doi.org/10.3390/separations8100178' },
    { label: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/' },
  ],
}
