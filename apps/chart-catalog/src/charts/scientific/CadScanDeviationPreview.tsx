import type { ChartPreviewProps } from '../../types'
import { CadScanDeviation } from './CadScanDeviation'
import { cadScanData, cadScanSource } from './cad-scan-data'

export default function CadScanDeviationPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use CadScanDeviation with a nominal mesh and registered 3D measurements.</p>
  }
  return <CadScanDeviation data={cadScanData} source={cadScanSource} label={example.title} compact={compact} />
}
