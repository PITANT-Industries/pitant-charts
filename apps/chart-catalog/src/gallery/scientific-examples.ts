import allanDeviation from './docs/examples/AllanDeviation.tsx?raw'
import hotellingProcessMonitor from './docs/examples/HotellingProcessMonitor.tsx?raw'
import weibullProbability from './docs/examples/WeibullProbabilityPlot.tsx?raw'
import kaplanMeier from './docs/examples/KaplanMeierReliability.tsx?raw'
import gaugeRR from './docs/examples/GaugeRR.tsx?raw'
import chromatogramPeakIntegration from './docs/examples/ChromatogramPeakIntegration.tsx?raw'
import lcMsFeatureMap from './docs/examples/LcMsFeatureMap.tsx?raw'
import spatialDefectMap from './docs/examples/SpatialDefectMap.tsx?raw'
import batchGenealogy from './docs/examples/BatchGenealogy.tsx?raw'
import bearingEnvelope from './docs/examples/BearingEnvelopeSpectrum.tsx?raw'
import binaryPhaseDiagram from './docs/examples/BinaryPhaseDiagram.tsx?raw'
import cadScanDeviation from './docs/examples/CadScanDeviation.tsx?raw'
import campbellDiagram from './docs/examples/CampbellDiagram.tsx?raw'
import capabilityHistogram from './docs/examples/CapabilityHistogram.tsx?raw'
import cieChromaticityDiagram from './docs/examples/CieChromaticityDiagram.tsx?raw'
import coherencePhase from './docs/examples/CoherencePhase.tsx?raw'
import correlationMatrix from './docs/examples/CorrelationMatrix.tsx?raw'
import crackGrowth from './docs/examples/CrackGrowth.tsx?raw'
import eyeDiagram from './docs/examples/EyeDiagram.tsx?raw'
import fatigueSn from './docs/examples/FatigueSn.tsx?raw'
import frequencyResponse from './docs/examples/FrequencyResponse.tsx?raw'
import fullFieldStrain from './docs/examples/FullFieldStrain.tsx?raw'
import hyperspectralCube from './docs/examples/HyperspectralCube.tsx?raw'
import individualsControlChart from './docs/examples/IndividualsControlChart.tsx?raw'
import industrialCtViewer from './docs/examples/IndustrialCtViewer.tsx?raw'
import massSpectrumMirror from './docs/examples/MassSpectrumMirror.tsx?raw'
import modeShapes from './docs/examples/ModeShapes.tsx?raw'
import paretoFrontier from './docs/examples/ParetoFrontier.tsx?raw'
import pcaBiplot from './docs/examples/PcaBiplot.tsx?raw'
import phasePlane from './docs/examples/PhasePlane.tsx?raw'
import responseSurface from './docs/examples/ResponseSurface.tsx?raw'
import shaftOrbit from './docs/examples/ShaftOrbit.tsx?raw'
import spectrogram from './docs/examples/Spectrogram.tsx?raw'
import spectrum from './docs/examples/Spectrum.tsx?raw'
import steelDefectCorrelation from './docs/examples/SteelDefectCorrelation.tsx?raw'
import stressStrainComparison from './docs/examples/StressStrainComparison.tsx?raw'
import ternaryMixtureMap from './docs/examples/TernaryMixtureMap.tsx?raw'
import waveletScalogram from './docs/examples/WaveletScalogram.tsx?raw'
import xrdPeakTracker from './docs/examples/XrdPeakTracker.tsx?raw'

function withCatalogImports(source: string) {
  return source
    .replace("from '../../../index'", "from '@pitant/chart-catalog'")
    .replace("import '../../../charts.css'", "import '@pitant/chart-catalog/styles.css'")
}

const scientificExamples = new Map([
  ['campbell-diagram-ottawa', withCatalogImports(campbellDiagram)],
  ['mode-shapes-cantilever', withCatalogImports(modeShapes)],
  ['shaft-orbit-probes', withCatalogImports(shaftOrbit)],
  ['frequency-response-servo', withCatalogImports(frequencyResponse)],
  ['coherence-phase-bearing', withCatalogImports(coherencePhase)],
  ['wavelet-scalogram-bearing', withCatalogImports(waveletScalogram)],
  ['bearing-envelope-ottawa', withCatalogImports(bearingEnvelope)],
  ['eye-diagram-nrz', withCatalogImports(eyeDiagram)],
  ['allan-deviation-stability', withCatalogImports(allanDeviation)],
  ['phase-plane-pendulum', withCatalogImports(phasePlane)],
  ['xrd-peak-tracker-dynic2', withCatalogImports(xrdPeakTracker)],
  ['stress-strain-heat-treatment', withCatalogImports(stressStrainComparison)],
  ['full-field-strain-tensile', withCatalogImports(fullFieldStrain)],
  ['fatigue-sn-measured', withCatalogImports(fatigueSn)],
  ['crack-growth-fatigue', withCatalogImports(crackGrowth)],
  ['binary-phase-diagram-ag-cu', withCatalogImports(binaryPhaseDiagram)],
  ['ternary-mixture-response', withCatalogImports(ternaryMixtureMap)],
  ['industrial-ct-porosity', withCatalogImports(industrialCtViewer)],
  ['cad-scan-deviation-registered', withCatalogImports(cadScanDeviation)],
  ['cie-chromaticity-gamuts', withCatalogImports(cieChromaticityDiagram)],
  ['hyperspectral-cube-cuprite', withCatalogImports(hyperspectralCube)],
  ['response-surface-thermal', withCatalogImports(responseSurface)],
  ['mass-spectrum-mirror-caffeine', withCatalogImports(massSpectrumMirror)],
  ['pca-biplot-glass', withCatalogImports(pcaBiplot)],
  ['pareto-frontier-oil-press', withCatalogImports(paretoFrontier)],
  ['pareto-frontier-turning', withCatalogImports(paretoFrontier)],
  ['batch-genealogy-enclosures', withCatalogImports(batchGenealogy)],
  ['spatial-defect-map-measured', withCatalogImports(spatialDefectMap)],
  ['spatial-defect-map-simulated', withCatalogImports(spatialDefectMap)],
  ['lcms-feature-map-openms', withCatalogImports(lcMsFeatureMap)],
  ['chromatogram-peak-integration-coffee', withCatalogImports(chromatogramPeakIntegration)],
  ['gauge-rr-thread-baseline', withCatalogImports(gaugeRR)],
  ['gauge-rr-thread-corrected', withCatalogImports(gaugeRR)],
  ['kaplan-meier-glass-capacitors', withCatalogImports(kaplanMeier)],
  ['weibull-probability-bearing-greases', withCatalogImports(weibullProbability)],
  ['weibull-probability-suppliers', withCatalogImports(weibullProbability)],
  ['hotelling-process-monitor-milling', withCatalogImports(hotellingProcessMonitor)],
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
