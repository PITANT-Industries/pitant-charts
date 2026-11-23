import type { ChartPreviewProps } from '../../types'
import { TernaryMixtureMap } from './TernaryMixtureMap'
import { ternaryMixtureData, ternaryMixtureSource } from './ternary-mixture-data'

export default function TernaryMixtureMapPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use TernaryMixtureMap with three-part observations and fitted response coefficients.</p>
  }
  return <TernaryMixtureMap data={ternaryMixtureData} source={ternaryMixtureSource} label={example.title}
    compact={compact} initialFractions={[.3, .6, .1]} />
}
