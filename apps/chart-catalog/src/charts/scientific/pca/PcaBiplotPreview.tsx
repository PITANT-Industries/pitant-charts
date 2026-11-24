import type { ChartPreviewProps } from '../../../types'
import { PcaBiplot } from './PcaBiplot'
import { glassPcaData } from './fixture'

const glassPcaSource = {
  label: 'B. German, UCI Glass Identification',
  href: 'https://doi.org/10.24432/C5WW2P',
  description: 'Refractive index and eight oxide composition measurements for 214 specimens across six glass product categories.',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
}

export default function PcaBiplotPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use PcaBiplot with a measured observation table.</p>
  }
  return <PcaBiplot data={glassPcaData} source={glassPcaSource} label={example.title} compact={compact}
    initialVariable="mg" initialObservation="192" />
}
