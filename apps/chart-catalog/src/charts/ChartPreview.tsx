import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import type { ChartPreviewProps } from '../types'
import { ChartThemeContext, fallbackChartTheme, readChartTheme } from './theme'

const Cartesian = lazy(() => import('./cartesian'))
const PolarFlow = lazy(() => import('./polarflow'))
const StatsMaps = lazy(() => import('./statsmaps'))
const DenseLine = lazy(() => import('./cartesian/LineLargeDetail'))
const DenseScatter = lazy(() => import('./statsmaps/dense-scatter/DenseScatter'))
const CampbellPreview = lazy(() => import('./scientific/campbell/CampbellPreview'))
const ModeShapesPreview = lazy(() => import('./scientific/modes/ModeShapesPreview'))
const MaunaLoaSpectrogram = lazy(() => import('./scientific/MaunaLoaSpectrogram'))
const ShaftOrbitPreview = lazy(() => import('./scientific/orbit/ShaftOrbitPreview'))
const FrequencyResponsePreview = lazy(() => import('./scientific/response/FrequencyResponsePreview'))
const CoherencePhasePreview = lazy(() => import('./scientific/coherence/CoherencePhasePreview'))
const WaveletScalogramPreview = lazy(() => import('./scientific/wavelet/WaveletScalogramPreview'))
const BearingEnvelopeSpectrumPreview = lazy(() => import('./scientific/envelope/BearingEnvelopeSpectrumPreview'))
const EyeDiagramPreview = lazy(() => import('./scientific/eye/EyeDiagramPreview'))
const AllanDeviationPreview = lazy(() => import('./scientific/AllanDeviationPreview'))
const PhasePlanePreview = lazy(() => import('./scientific/PhasePlanePreview'))
const XrdPeakTrackerPreview = lazy(() => import('./scientific/XrdPeakTrackerPreview'))
const StressStrainComparisonPreview = lazy(() => import('./scientific/StressStrainComparisonPreview'))
const FullFieldStrainPreview = lazy(() => import('./scientific/FullFieldStrainPreview'))
const FatigueSnPreview = lazy(() => import('./scientific/FatigueSnPreview'))
const CrackGrowthPreview = lazy(() => import('./scientific/CrackGrowthPreview'))
const BinaryPhaseDiagramPreview = lazy(() => import('./scientific/BinaryPhaseDiagramPreview'))
const TernaryMixtureMapPreview = lazy(() => import('./scientific/TernaryMixtureMapPreview'))
const IndustrialCtViewerPreview = lazy(() => import('./scientific/IndustrialCtViewerPreview'))
const CadScanDeviationPreview = lazy(() => import('./scientific/CadScanDeviationPreview'))
const CieChromaticityDiagramPreview = lazy(() => import('./scientific/CieChromaticityDiagramPreview'))
const HyperspectralCubePreview = lazy(() => import('./scientific/HyperspectralCubePreview'))
const ResponseSurfacePreview = lazy(() => import('./scientific/ResponseSurfacePreview'))
const Scientific = lazy(() => import('./scientific/ScientificPreview'))
const MassSpectrumMirrorPreview = lazy(() => import('./scientific/mirror-spectrum/MassSpectrumMirrorPreview'))
const ParticleMassSpectrum = lazy(() => import('./scientific/particle/ParticleMassSpectrumPreview'))
const ScientificWaterfall = lazy(() => import('./scientific/waterfall/SpectralWaterfallPreview'))

export const rendererFamilies = {
  cartesian: ['line', 'area', 'live-line', 'sparkline', 'candlestick', 'stream', 'bar', 'diverging', 'composed', 'lollipop', 'dumbbell', 'bump', 'slope', 'waterfall', 'gantt'],
  polarflow: ['pie', 'ring', 'radial', 'gauge', 'waffle', 'marimekko', 'funnel', 'sankey', 'sunburst', 'treemap', 'tree', 'network', 'radar', 'tooltip'],
  waterfall: ['spectral-waterfall'],
  particle: ['mass-spectrum'],
  mirrorSpectrum: ['mass-spectrum-mirror'],
  campbell: ['campbell-diagram'],
  modes: ['mode-shapes'],
  orbit: ['shaft-orbit'],
  response: ['frequency-response'],
  coherence: ['coherence-phase'],
  wavelet: ['wavelet-scalogram'],
  envelope: ['bearing-envelope'],
  eye: ['eye-diagram'],
  allan: ['allan-deviation'],
  phasePlane: ['phase-plane'],
  xrdPeakTracker: ['xrd-peak-tracker'],
  stressStrainComparison: ['stress-strain-comparison'],
  fullFieldStrain: ['full-field-strain'],
  fatigueSn: ['fatigue-sn'],
  crackGrowth: ['crack-growth'],
  binaryPhaseDiagram: ['binary-phase-diagram'],
  ternaryMixtureMap: ['ternary-mixture-map'],
  industrialCt: ['industrial-ct'],
  cadScanDeviation: ['cad-scan-deviation'],
  cieChromaticity: ['cie-chromaticity'],
  hyperspectralCube: ['hyperspectral-cube'],
  responseSurface: ['response-surface'],
  spectrogram: ['spectrogram'],
  scientific: ['spectrum', 'correlation-matrix', 'process-control'],
  statsmaps: ['scatter', 'heatmap', 'uncertainty', 'histogram', 'ridgeline', 'ecdf', 'beeswarm', 'violin', 'box-plot', 'hexbin', 'density', 'choropleth', 'bubble-map', 'route-map', 'globe', 'vector-field'],
} as const

const renderers = new Map<string, ComponentType<ChartPreviewProps>>([
  ...rendererFamilies.cartesian.map((id) => [id, Cartesian] as const),
  ...rendererFamilies.polarflow.map((id) => [id, PolarFlow] as const),
  ...rendererFamilies.mirrorSpectrum.map((id) => [id, MassSpectrumMirrorPreview] as const),
  ...rendererFamilies.particle.map((id) => [id, ParticleMassSpectrum] as const),
  ...rendererFamilies.campbell.map((id) => [id, CampbellPreview] as const),
  ...rendererFamilies.modes.map((id) => [id, ModeShapesPreview] as const),
  ...rendererFamilies.orbit.map((id) => [id, ShaftOrbitPreview] as const),
  ...rendererFamilies.response.map((id) => [id, FrequencyResponsePreview] as const),
  ...rendererFamilies.coherence.map((id) => [id, CoherencePhasePreview] as const),
  ...rendererFamilies.wavelet.map((id) => [id, WaveletScalogramPreview] as const),
  ...rendererFamilies.envelope.map((id) => [id, BearingEnvelopeSpectrumPreview] as const),
  ...rendererFamilies.eye.map((id) => [id, EyeDiagramPreview] as const),
  ...rendererFamilies.allan.map((id) => [id, AllanDeviationPreview] as const),
  ...rendererFamilies.phasePlane.map((id) => [id, PhasePlanePreview] as const),
  ...rendererFamilies.xrdPeakTracker.map((id) => [id, XrdPeakTrackerPreview] as const),
  ...rendererFamilies.stressStrainComparison.map((id) => [id, StressStrainComparisonPreview] as const),
  ...rendererFamilies.fullFieldStrain.map((id) => [id, FullFieldStrainPreview] as const),
  ...rendererFamilies.fatigueSn.map((id) => [id, FatigueSnPreview] as const),
  ...rendererFamilies.crackGrowth.map((id) => [id, CrackGrowthPreview] as const),
  ...rendererFamilies.binaryPhaseDiagram.map((id) => [id, BinaryPhaseDiagramPreview] as const),
  ...rendererFamilies.ternaryMixtureMap.map((id) => [id, TernaryMixtureMapPreview] as const),
  ...rendererFamilies.industrialCt.map((id) => [id, IndustrialCtViewerPreview] as const),
  ...rendererFamilies.cadScanDeviation.map((id) => [id, CadScanDeviationPreview] as const),
  ...rendererFamilies.cieChromaticity.map((id) => [id, CieChromaticityDiagramPreview] as const),
  ...rendererFamilies.hyperspectralCube.map((id) => [id, HyperspectralCubePreview] as const),
  ...rendererFamilies.responseSurface.map((id) => [id, ResponseSurfacePreview] as const),
  ...rendererFamilies.waterfall.map((id) => [id, ScientificWaterfall] as const),
  ...rendererFamilies.spectrogram.map((id) => [id, MaunaLoaSpectrogram] as const),
  ...rendererFamilies.scientific.map((id) => [id, Scientific] as const),
  ...rendererFamilies.statsmaps.map((id) => [id, StatsMaps] as const),
])

class ChartBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? <div className="chart-render-message" role="alert">This chart could not render.</div> : this.props.children
  }
}

export function ChartPreview(props: ChartPreviewProps) {
  const Renderer = props.example.id === 'line-large-data' ? DenseLine
    : props.example.id === 'scatter-large-data' ? DenseScatter
      : renderers.get(props.example.family)
  const host = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState(fallbackChartTheme)
  useEffect(() => {
    const element = host.current
    if (!element) return
    let frame = 0
    const read = () => {
      const next = readChartTheme(element)
      setTheme((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(read)
    }
    const observer = new MutationObserver(schedule)
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
      observer.observe(ancestor, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', schedule)
    window.addEventListener('chart-theme-change', schedule)
    read()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      media.removeEventListener('change', schedule)
      window.removeEventListener('chart-theme-change', schedule)
    }
  }, [Renderer])
  if (!Renderer) return <div className="chart-render-message" role="alert">Chart family unavailable.</div>
  return (
    <div ref={host} className={`chart-preview${props.compact ? ' chart-preview--compact' : ''}`}>
      <ChartThemeContext.Provider value={theme}>
        <ChartBoundary key={props.example.id}>
          <Suspense fallback={<div className="chart-skeleton" role="status" aria-label="Loading chart" />}>
            <Renderer {...props} />
          </Suspense>
        </ChartBoundary>
      </ChartThemeContext.Provider>
    </div>
  )
}
