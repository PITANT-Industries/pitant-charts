import type { ChartPreviewProps } from '../../../types'
import { BearingEnvelopeSpectrum } from './BearingEnvelopeSpectrum'
import fixture from './envelope-fixture.json'

const levelDomainDb = [-65, 0] as const

export default function BearingEnvelopeSpectrumPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use BearingEnvelopeSpectrum with carrier-frequency and shaft-order arrays.</p>
  }
  return <BearingEnvelopeSpectrum data={fixture} source={fixture.source} label={example.title} compact={compact} levelDomainDb={levelDomainDb}
    initialBandId={fixture.initialBandId} initialRunId={fixture.initialRunId} initialOrder={fixture.initialOrder} />
}
