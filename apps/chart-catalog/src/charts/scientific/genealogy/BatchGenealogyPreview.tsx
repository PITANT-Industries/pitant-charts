import type { ChartPreviewProps } from '../../../types'
import { BatchGenealogy } from './BatchGenealogy'
import { enclosureGenealogyData, enclosureGenealogySource } from './fixture'

export default function BatchGenealogyPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use BatchGenealogy with lot identities and recorded input and output events.</p>
  }
  return <BatchGenealogy data={enclosureGenealogyData} source={enclosureGenealogySource}
    label={example.title} initialLot="HG-12-R2" compact={compact} />
}
