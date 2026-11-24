import type { ChartPreviewProps } from '../../../types'
import { spectrogramFixture } from '../data'
import { XrdPeakTracker } from '../XrdPeakTracker'
import { xrdPeakData } from '../xrd-peak-data'
import type { SpectralSelection, SpectralWaterfallAxes, SpectralWaterfallData } from './model'
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
  dataset: 'NOAA Mauna Loa CO₂ observations',
  description: spectrogramFixture.description,
  source: { label: spectrogramFixture.sourceLabel, href: spectrogramFixture.sourceUrl },
}

function renderPeakFit({ scanIndex, binIndex }: SpectralSelection) {
  const angle = xrdPeakData.angleDeg[binIndex]
  const temperatureK = xrdPeakData.scans[scanIndex].temperatureK
  const peak = xrdPeakData.peaks.find(({ windowDeg: [start, end] }) => angle >= start && angle <= end)

  return (
    <section className="xrd-waterfall-fit" data-xrd-waterfall-fit aria-label="DyNiC₂ diffraction peak fit">
      <strong>Diffraction peak fit{peak ? ` · ${peak.label}` : ''}</strong>
      <p>Use the plot or the spectral bin slider to select a peak near 5.20°, 5.29°, or 5.36°.</p>
      {peak ? (
        <XrdPeakTracker data={xrdPeakData} selection={{ peakId: peak.id, temperatureK }} label="DyNiC₂ peak fit" />
      ) : <p data-xrd-waterfall-empty role="status">No fit covers the selected diffraction angle.</p>}
    </section>
  )
}

export default function SpectralWaterfallPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use the typed SpectralWaterfall input in the chart guide to plot your own scans.</p>
  }
  if (example.id === 'spectral-waterfall-xrd') {
    return <SpectralWaterfall {...xrdWaterfall} dataset="DyNiC₂ synchrotron X-ray diffraction"
      compact={compact} label={example.title} renderSelection={renderPeakFit} />
  }
  return <SpectralWaterfall {...co2Waterfall} compact={compact} label={example.title} />
}
