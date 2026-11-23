import type { ChartPreviewProps } from '../../types'
import { XrdPeakTracker } from './XrdPeakTracker'
import { xrdPeakData, xrdPeakSource } from './xrd-peak-data'

const [low, middle, high] = xrdPeakData.peaks
const exampleData = { ...xrdPeakData, peaks: [high, low, middle] }

export default function XrdPeakTrackerPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use XrdPeakTracker with aligned diffraction scans and fitted peaks.</p>
  }
  return <XrdPeakTracker data={exampleData} source={xrdPeakSource} label={example.title} compact={compact} initialTemperatureK={144.29} />
}
