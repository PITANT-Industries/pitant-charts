import { ChromatogramPeakIntegration, type ChromatogramData } from '../../../index'
import '../../../charts.css'

// Simulated detector readings with unequal sampling intervals.
const data: ChromatogramData = {
  timeUnit: 'min',
  signalUnit: 'mAU',
  samples: [
    [0, 2], [0.5, 2], [1, 1], [2, 5], [2.75, 3], [3.5, 2],
    [4.1, 2], [4.6, 6], [5.2, 4], [5.9, 2], [6.3, 2],
  ],
  peaks: [
    { id: 'peak-1', label: 'Peak 1', start: 0.75, end: 3.5, baseline: [2, 2] },
    { id: 'peak-2', label: 'Peak 2', start: 4.1, end: 5.9 },
  ],
}

export function ExampleChromatogramPeakIntegration() {
  return <ChromatogramPeakIntegration data={data} initialPeak="peak-1" label="Simulated two-peak chromatogram" />
}
