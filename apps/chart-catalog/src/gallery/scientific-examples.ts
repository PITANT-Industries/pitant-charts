import campbellDiagram from './docs/examples/CampbellDiagram.tsx?raw'
import capabilityHistogram from './docs/examples/CapabilityHistogram.tsx?raw'
import correlationMatrix from './docs/examples/CorrelationMatrix.tsx?raw'
import individualsControlChart from './docs/examples/IndividualsControlChart.tsx?raw'
import spectrogram from './docs/examples/Spectrogram.tsx?raw'
import spectrum from './docs/examples/Spectrum.tsx?raw'
import steelDefectCorrelation from './docs/examples/SteelDefectCorrelation.tsx?raw'

const scientificExamples = new Map([
  ['campbell-diagram-ottawa', campbellDiagram
    .replace("from '../../../index'", "from '@pitant/chart-catalog'")
    .replace("import '../../../charts.css'", "import '@pitant/chart-catalog/styles.css'")],
  ['spectrum-measured', spectrum],
  ['spectrogram-measured', spectrogram],
  ['correlation-matrix-measured', correlationMatrix],
  ['correlation-matrix-steel', steelDefectCorrelation],
  ['process-control-individuals', individualsControlChart],
  ['process-control-capability', capabilityHistogram],
])

const waterfall = `import { SpectralWaterfall, type SpectralWaterfallData } from '@pitant/chart-catalog'
import '@pitant/chart-catalog/styles.css'

// Replace these illustrative readings with your own aligned scans.
const data: SpectralWaterfallData = {
  spectralBins: new Float64Array([5.1, 5.2, 5.3, 5.4]),
  scanValues: new Float64Array([10, 100, 300]),
  values: new Float64Array([
    9, 22, 142, 17,
    11, 40, 119, 15,
    15, 134, 45, NaN,
  ]),
}

export function DiffractionWaterfall() {
  return (
    <SpectralWaterfall
      data={data}
      label="Diffraction scans by temperature"
      axes={{
        spectral: { label: 'Diffraction angle', unit: '° 2θ' },
        scan: { label: 'Temperature', unit: 'K' },
        intensity: { label: 'Intensity', unit: 'a.u.' },
      }}
    />
  )
}
`

export function scientificExampleSource(exampleId: string): string | undefined {
  if (exampleId === 'spectral-waterfall-co2' || exampleId === 'spectral-waterfall-xrd') return waterfall
  return scientificExamples.get(exampleId)
}
