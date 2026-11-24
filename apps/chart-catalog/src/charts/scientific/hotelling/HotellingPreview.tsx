import type { ChartPreviewProps } from '../../../types'
import { HotellingProcessMonitor } from './HotellingProcessMonitor'
import { measuredHotelling, measuredHotellingInitialRun, measuredHotellingSource } from './fixture'

export default function HotellingPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use HotellingProcessMonitor with reference and monitored channel readings.</p>
  }
  return <HotellingProcessMonitor data={measuredHotelling} initialRun={measuredHotellingInitialRun}
    source={measuredHotellingSource} label={example.title} compact={compact} />
}
