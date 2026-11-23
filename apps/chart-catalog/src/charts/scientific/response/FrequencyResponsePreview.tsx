import type { ChartPreviewProps } from '../../../types'
import { FrequencyResponse } from './FrequencyResponse'
import { demoFrequencyResponse } from './frequency-response'

const [nominal, higherGain] = demoFrequencyResponse.responses
const galleryResponse = { responses: [higherGain, nominal] }
const source = {
  label: 'Simulated flexible servo loop',
  description: 'A 28 Hz resonance and a 45 Hz lag pole shape the loop response. The dotted Nyquist branch reflects negative frequencies.',
  href: 'https://www.cds.caltech.edu/~murray/books/AM05/pdf/fbs-loopanal_13Aug2019.pdf',
}

export default function FrequencyResponsePreview({ example, compact, data }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use FrequencyResponse with aligned frequency and complex response arrays.</p>
  }
  return <FrequencyResponse data={compact ? galleryResponse : demoFrequencyResponse} source={source} label={example.title} compact={compact} />
}
