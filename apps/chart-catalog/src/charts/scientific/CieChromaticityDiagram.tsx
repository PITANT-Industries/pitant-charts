import { useMemo, useState } from 'react'
import { CieChromaticityPlot } from './CieChromaticityPlot'
import { analyseCieChromaticity, cieCompare, cieContains, cieDomain, cieUv, cieXy } from './cie-chromaticity-model'
import type { ChromaticityPoint, ChromaticitySpace, CieChromaticityData } from './cie-chromaticity-model'
import './scientific-figure.css'
import './cie-chromaticity.css'

export type { ChromaticityPoint, ChromaticitySpace, CieChromaticityData, CieGamut, CieSpectralSample } from './cie-chromaticity-model'

export interface CieChromaticityDiagramProps {
  data: CieChromaticityData
  label?: string
  compact?: boolean
  source?: { label: string; href: string; description?: string; license?: string; licenseUrl?: string }
}

type Analysis = NonNullable<ReturnType<typeof analyseCieChromaticity>>
const coordinate = new Intl.NumberFormat('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const coverageFormat = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 })
const areaFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 })
const keepPoint = (point: ChromaticityPoint) => point

function GamutSelect({ label, gamuts, value, choose }: {
  label: string
  gamuts: Analysis['gamuts']
  value: string
  choose: (id: string) => void
}) {
  return (
    <label className="cie-control">{label}
      <select value={value} onChange={(event) => choose(event.currentTarget.value)}>
        {[...gamuts.values()].map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
      </select>
    </label>
  )
}

function ChromaticityFigure({ data, analysis, label, compact = false, source }: CieChromaticityDiagramProps & {
  analysis: Analysis
  label: string
}) {
  const [space, setSpace] = useState<ChromaticitySpace>('xy')
  const [referenceId, setReferenceId] = useState(analysis.reference.id)
  const [comparisonId, setComparisonId] = useState(analysis.comparison.id)
  const [selection, setSelection] = useState(analysis.initialPoint)
  const ref = analysis.gamuts.get(referenceId) ?? analysis.reference
  const comp = analysis.gamuts.get(comparisonId) ?? analysis.comparison
  const current = cieContains(analysis.locus, selection) ? selection : analysis.initialPoint
  const [u, v] = cieUv(current)
  const [x, y] = current
  const convert = space === 'xy' ? keepPoint : cieUv
  const spectral = useMemo(() => analysis.locus.map(convert), [analysis.locus, convert])
  const domain = useMemo(() => cieDomain([...spectral, ...[...analysis.gamuts.values()].flatMap(({ hull }) => hull.map(convert))], space),
    [spectral, analysis.gamuts, convert, space])
  const reference = useMemo(() => ({ hull: ref.hull.map(convert), white: ref.white ? convert(ref.white) : undefined }), [ref, convert])
  const comparison = useMemo(() => ({ hull: comp.hull.map(convert), white: comp.white ? convert(comp.white) : undefined }), [comp, convert])
  const intersection = useMemo(() => cieCompare(reference.hull, comparison.hull), [reference, comparison])
  const inReference = cieContains(ref.hull, current)
  const inComparison = cieContains(comp.hull, current)

  function choose(point: ChromaticityPoint) {
    const xy = space === 'xy' ? point : cieXy(point)
    if (xy.every(Number.isFinite) && cieContains(analysis.locus, xy)) setSelection(xy)
  }

  return (
    <figure className="cie-chromaticity" data-cie-chromaticity="" data-compact={compact} aria-label={label}>
      <div className="cie-layout">
        <div className="cie-figure">
          <CieChromaticityPlot space={space} domain={domain} spectral={spectral} wavelengths={data.locus}
            reference={reference} comparison={comparison} overlap={intersection.intersectionArea > 0 ? intersection.intersection : []}
            marker={convert(current)} selectedXy={current} compact={compact} choose={choose} />
          {!compact && <ul className="cie-legend" aria-label="Diagram legend">
            <li data-cie-key="reference">{ref.label} reference</li>
            <li data-cie-key="comparison">{comp.label} comparison</li>
            <li data-cie-key="overlap">Intersection</li>
            {(ref.white || comp.white) && <li data-cie-key="white">White point</li>}
          </ul>}
        </div>
        {!compact && <div className="cie-inspection">
          <div className="cie-controls">
            <label className="cie-control">Coordinate space
              <select value={space} onChange={(event) => setSpace(event.currentTarget.value as ChromaticitySpace)}>
                <option value="xy">CIE 1931 xy</option>
                <option value="uv">CIE 1976 u′v′</option>
              </select>
            </label>
            <GamutSelect label="Reference gamut" gamuts={analysis.gamuts} value={ref.id} choose={setReferenceId} />
            <GamutSelect label="Comparison gamut" gamuts={analysis.gamuts} value={comp.id} choose={setComparisonId} />
          </div>
          <output className="cie-readout" data-cie-readout="" data-x={x} data-y={y} data-u={u} data-v={v}
            data-reference={ref.id} data-comparison={comp.id}
            data-reference-area={intersection.referenceArea} data-comparison-area={intersection.comparisonArea}
            data-intersection-area={intersection.intersectionArea} data-coverage={intersection.coverage}
            data-comparison-coverage={intersection.comparisonCoverage} data-in-reference={inReference} data-in-comparison={inComparison}>
            <span className="cie-readout-title">Gamut area coverage</span>
            <span className="cie-readout-row">Reference covered <strong>{coverageFormat.format(intersection.coverage)}</strong></span>
            <span className="cie-readout-row">Comparison covered <strong>{coverageFormat.format(intersection.comparisonCoverage)}</strong></span>
            <span className="cie-readout-row">Intersection area <strong>{areaFormat.format(intersection.intersectionArea)}</strong></span>
            <span className="cie-readout-title cie-selected-title">Selected chromaticity</span>
            <span className="cie-readout-row"><span>x / y</span><strong>{coordinate.format(x)} / {coordinate.format(y)}</strong></span>
            <span className="cie-readout-row"><span>u′ / v′</span><strong>{coordinate.format(u)} / {coordinate.format(v)}</strong></span>
            <span className="cie-readout-row">{ref.label} reference <strong>{inReference ? 'Inside' : 'Outside'}</strong></span>
            <span className="cie-readout-row">{comp.label} comparison <strong>{inComparison ? 'Inside' : 'Outside'}</strong></span>
          </output>
        </div>}
      </div>
      {!compact && <figcaption className="cie-caption">
        <p>Boundary ticks show wavelength in nm. The color field is an approximate sRGB rendering.</p>
        {source && <p>
          <a href={source.href}>{source.label}</a>
          {source.license && (source.licenseUrl ? <> · <a href={source.licenseUrl}>{source.license}</a></> : ` · ${source.license}`)}
          {source.description && <> · {source.description}</>}
        </p>}
      </figcaption>}
    </figure>
  )
}

export function CieChromaticityDiagram({ data, label = 'CIE chromaticity and gamut', ...props }: CieChromaticityDiagramProps) {
  const analysis = useMemo(() => analyseCieChromaticity(data), [data])
  if (!analysis) return <p className="chart-render-message" role="status">Provide ordered spectral chromaticities and at least one gamut with three non-collinear primaries.</p>
  return <ChromaticityFigure data={data} analysis={analysis} label={label} {...props} />
}
