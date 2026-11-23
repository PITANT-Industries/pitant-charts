import capabilityHistogram from './docs/examples/CapabilityHistogram.tsx?raw'
import correlationMatrix from './docs/examples/CorrelationMatrix.tsx?raw'
import individualsControlChart from './docs/examples/IndividualsControlChart.tsx?raw'
import spectrogram from './docs/examples/Spectrogram.tsx?raw'
import spectrum from './docs/examples/Spectrum.tsx?raw'

const scientificExamples = new Map([
  ['spectrum-measured', spectrum],
  ['spectrogram-measured', spectrogram],
  ['correlation-matrix-measured', correlationMatrix],
  ['process-control-individuals', individualsControlChart],
  ['process-control-capability', capabilityHistogram],
])

export function scientificExampleSource(exampleId: string): string | undefined {
  return scientificExamples.get(exampleId)
}
