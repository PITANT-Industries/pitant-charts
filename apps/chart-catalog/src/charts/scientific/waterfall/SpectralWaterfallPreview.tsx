import type { ChartPreviewProps } from '../../../types'
import { spectrogramFixture } from '../data'
import type { SpectralWaterfallAxes, SpectralWaterfallData } from './model'
import { SpectralWaterfall } from './SpectralWaterfall'
import { xrdWaterfall } from './xrd'

const co2Data: SpectralWaterfallData = {
  spectralBins: spectrogramFixture.data.frequencyBins,
  scanValues: spectrogramFixture.data.timeBins,
  values: spectrogramFixture.data.values,
}

const co2Axes: SpectralWaterfallAxes = {
  spectral: { label: 'Frequency', unit: 'cycles/year' },
  scan: { label: 'Window center year' },
  intensity: { label: 'Amplitude', unit: 'ppm' },
}

const co2Waterfall = {
  data: co2Data,
  axes: co2Axes,
  description: spectrogramFixture.description,
  source: { label: spectrogramFixture.sourceLabel, href: spectrogramFixture.sourceUrl },
}

export default function SpectralWaterfallPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use the typed SpectralWaterfall input in the chart guide to plot your own scans.</p>
  }
  const fixture = example.id === 'spectral-waterfall-xrd' ? xrdWaterfall : co2Waterfall
  return <SpectralWaterfall {...fixture} compact={compact} label={example.title} />
}
