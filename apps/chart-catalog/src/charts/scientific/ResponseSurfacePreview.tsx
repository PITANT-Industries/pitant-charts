import type { ChartPreviewProps } from '../../types'
import { ResponseSurface } from './ResponseSurface'
import { responseSurfaceData, responseSurfaceSource } from './response-surface-data'

export default function ResponseSurfacePreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use ResponseSurface with a response model over a factor domain.</p>
  }
  return <ResponseSurface data={responseSurfaceData} source={responseSurfaceSource} label={example.title} compact={compact} />
}
