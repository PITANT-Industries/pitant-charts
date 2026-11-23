import type { ChartPreviewProps } from '../../types'
import { IndustrialCtViewer } from './IndustrialCtViewer'
import { industrialCtData, industrialCtSource } from './industrial-ct-data'

export default function IndustrialCtViewerPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use IndustrialCtViewer with a calibrated volume and matching segmentation labels.</p>
  }
  return <IndustrialCtViewer data={industrialCtData} source={industrialCtSource}
    label={example.title} compact={compact} initialPoreId={1} />
}
