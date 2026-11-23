import { useId, useMemo, useState } from 'react'
import { usePlotSize } from '../usePlotSize'
import './scientific-figure.css'
import './stress-strain-comparison.css'

export interface StressStrainPoint {
  strain: number
  stressMpa: number
}

export interface StressStrainElasticFit {
  startStrain: number
  endStrain: number
  modulusMpa: number
  interceptMpa: number
}

export interface StressStrainCurve {
  id: string
  label: string
  points: readonly StressStrainPoint[]
  elasticFit: StressStrainElasticFit
  fractureIndex?: number
}

export interface StressStrainData {
  curves: readonly StressStrainCurve[]
}

export interface StressStrainComparisonProps {
  data: StressStrainData
  label?: string
  compact?: boolean
  source?: { label: string; href: string; description?: string; license?: string; licenseUrl?: string }
}

type Domain = readonly [number, number]
type Ranges = { strain: Domain; stress: Domain }
type Result = Omit<StressStrainCurve, 'fractureIndex'> & {
  proof: StressStrainPoint | null
  ultimate: StressStrainPoint
  endpoint: StressStrainPoint
  fracture: boolean
}

const proofOffset = .002
const colors = ['#225781', '#a04430', '#386a54', '#695185']
const dashes = [undefined, '6 3', '2 3', '8 3 2 3']
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

function stressAt(fit: StressStrainElasticFit, strain: number, offset = 0) {
  return fit.modulusMpa * (strain - offset) + fit.interceptMpa
}

function proofPoint(points: readonly StressStrainPoint[], fit: StressStrainElasticFit): StressStrainPoint | null {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (b.strain < fit.endStrain) continue
    const before = a.stressMpa - stressAt(fit, a.strain, proofOffset)
    const after = b.stressMpa - stressAt(fit, b.strain, proofOffset)
    if (before <= 0 || after > 0) continue
    const fraction = before / (before - after)
    const strain = a.strain + fraction * (b.strain - a.strain)
    if (strain >= fit.endStrain) return { strain, stressMpa: stressAt(fit, strain, proofOffset) }
  }
  return null
}

function resultFor(curve: StressStrainCurve): Result | null {
  const { id, label, elasticFit, fractureIndex, points: samples } = curve
  if (samples.length < 2 || !samples.every(({ strain, stressMpa }, i) =>
    Number.isFinite(strain) && Number.isFinite(stressMpa) && (i === 0 || strain > samples[i - 1].strain))) return null
  if (fractureIndex !== undefined && (!Number.isInteger(fractureIndex) || fractureIndex < 1 || fractureIndex >= samples.length)) return null
  const points = fractureIndex === undefined ? samples : samples.slice(0, fractureIndex + 1)
  const endpoint = points[points.length - 1]
  const { startStrain, endStrain, modulusMpa, interceptMpa } = elasticFit
  if (![startStrain, endStrain, modulusMpa, interceptMpa].every(Number.isFinite) ||
      modulusMpa <= 0 || startStrain >= endStrain || startStrain < points[0].strain || endStrain > endpoint.strain) return null
  const ultimate = points.reduce((maximum, point) => point.stressMpa > maximum.stressMpa ? point : maximum)
  return { id, label, points, elasticFit, proof: proofPoint(points, elasticFit), ultimate, endpoint, fracture: fractureIndex !== undefined }
}

function rangesFor(results: readonly Result[]) {
  let strainMin = 0
  let strainMax = 0
  let stressMin = 0
  let stressMax = 0
  let detailMin = 0
  let detailMax = proofOffset * 2
  for (const result of results) {
    const { elasticFit, points, endpoint, proof, ultimate } = result
    strainMin = Math.min(strainMin, points[0].strain)
    strainMax = Math.max(strainMax, endpoint.strain)
    stressMax = Math.max(stressMax, ultimate.stressMpa)
    detailMin = Math.min(detailMin, points[0].strain, -elasticFit.interceptMpa / elasticFit.modulusMpa)
    detailMax = Math.max(detailMax, elasticFit.endStrain + proofOffset, proof ? proof.strain * 1.3 : 0)
    for (const { stressMpa } of points) stressMin = Math.min(stressMin, stressMpa)
  }
  let detailStressMax = 0
  for (const { points, proof } of results) {
    if (proof) detailStressMax = Math.max(detailStressMax, proof.stressMpa)
    for (const point of points) {
      detailStressMax = Math.max(detailStressMax, point.stressMpa)
      if (point.strain >= detailMax) break
    }
  }
  const upperStress = (maximum: number) => maximum + Math.max(1, (maximum - stressMin) * .08)
  const overview = { strain: [strainMin, strainMax + (strainMax - strainMin) * .035],
    stress: [stressMin, upperStress(stressMax)] } satisfies Ranges
  const detail = { strain: [detailMin, detailMax], stress: [stressMin, upperStress(detailStressMax)] } satisfies Ranges
  if ([overview, detail].some((range) =>
    Object.values(range).some(([min, max]) => max <= min || !Number.isFinite(max - min)))) return null
  return { overview, detail }
}

function analyse(data: StressStrainData) {
  if (!data.curves.length || new Set(data.curves.map(({ id }) => id)).size !== data.curves.length) return null
  const results: Result[] = []
  for (const curve of data.curves) {
    const result = resultFor(curve)
    if (!result) return null
    results.push(result)
  }
  const ranges = rangesFor(results)
  return ranges && { results, ...ranges }
}

function ticks([min, max]: Domain, target: number) {
  const approximate = (max - min) / target
  const base = 10 ** Math.floor(Math.log10(approximate))
  const step = base * ([1, 2, 2.5, 5, 10].find((multiple) => base * multiple >= approximate) ?? 10)
  if (!Number.isFinite(step) || step <= 0) return [min, max]
  const first = Math.ceil(min / step)
  const last = Math.floor(max / step)
  return last > first ? Array.from({ length: Math.min(10, last - first + 1) }, (_, i) => (first + i) * step) : [min, max]
}

function linePath(points: readonly StressStrainPoint[], x: (value: number) => number, y: (value: number) => number) {
  return points.map(({ strain, stressMpa }, index) => `${index ? 'L' : 'M'}${x(strain).toFixed(3)} ${y(stressMpa).toFixed(3)}`).join(' ')
}

function FitLine({ fit, range, x, y, offset = 0 }: {
  fit: StressStrainElasticFit
  range: Ranges
  x: (value: number) => number
  y: (value: number) => number
  offset?: number
}) {
  const intercept = stressAt(fit, 0, offset)
  const from = Math.max(range.strain[0], (range.stress[0] - intercept) / fit.modulusMpa)
  const to = Math.min(range.strain[1], (range.stress[1] - intercept) / fit.modulusMpa)
  if (!(to > from)) return null
  return <path className={offset ? 'stress-offset' : 'stress-elastic'} data-stress-offset={offset ? '' : undefined}
    data-stress-elastic={offset ? undefined : ''} data-offset-strain={offset} data-intercept={intercept} data-slope={fit.modulusMpa}
    d={`M${x(from)} ${y(stressAt(fit, from, offset))}L${x(to)} ${y(stressAt(fit, to, offset))}`} />
}

function TensilePlot({ range, results, selected, mode, label, compact = false }: {
  range: Ranges
  results: readonly Result[]
  selected: number
  mode: 'overview' | 'detail'
  label: string
  compact?: boolean
}) {
  const clipId = useId()
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 420 : 770, compact ? 173 : 310)
  const left = width < 355 ? 48 : 55
  const right = Math.max(left + 1, width - 21)
  const top = compact ? 15 : 24
  const bottom = Math.max(top + 1, height - 43)
  const x = (strain: number) => left + (strain - range.strain[0]) / (range.strain[1] - range.strain[0]) * (right - left)
  const y = (stress: number) => bottom - (stress - range.stress[0]) / (range.stress[1] - range.stress[0]) * (bottom - top)
  const active = results[selected]
  const color = colors[selected % colors.length]
  const detail = mode === 'detail'
  const title = detail ? 'Elastic and proof-stress region' : 'Full tensile curves'
  const detailEnd = detail ? active.points.findIndex(({ strain }) => strain > range.strain[1]) : -1
  const detailPoints = detailEnd === -1 ? active.points : active.points.slice(0, detailEnd + 1)

  return (
    <div className={`stress-${mode} scientific-plot`} ref={plot}>
      <svg role="img" aria-label={`${label}. ${detail ? `${title}, ${active.label}` : title}.`}
        data-stress-overview={detail ? undefined : ''} data-stress-detail={detail ? '' : undefined}
        viewBox={`0 0 ${width} ${height}`}>
        <defs><clipPath id={clipId}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath></defs>
        <g className="scientific-axis" aria-hidden="true">
          {!compact && <text className="scientific-panel-title" x={left} y={13}>{title}</text>}
          {ticks(range.strain, width < 380 ? 4 : 6).map((value) => (
            <g key={value}>
              <line className="scientific-tick" x1={x(value)} x2={x(value)} y1={bottom} y2={bottom + 4} />
              <text x={x(value)} y={bottom + 17} textAnchor="middle">{number.format(value * 100)}</text>
            </g>
          ))}
          {ticks(range.stress, compact ? 3 : 5).map((value) => (
            <g key={value}>
              <line className="scientific-tick" x1={left - 4} x2={left} y1={y(value)} y2={y(value)} />
              <text x={left - 8} y={y(value) + 4} textAnchor="end">{number.format(value)}</text>
            </g>
          ))}
          <rect className="scientific-frame" data-stress-axis-frame="" x={left} y={top} width={right - left} height={bottom - top} />
          <text className="scientific-axis-label" x={(left + right) / 2} y={height - 6} textAnchor="middle">Engineering strain, ε (%)</text>
          <text className="scientific-axis-label stress-axis-y" transform={`translate(13 ${(top + bottom) / 2}) rotate(-90)`}
            textAnchor="middle">Engineering stress, σ (MPa)</text>
        </g>
        <g clipPath={`url(#${clipId})`} aria-hidden="true">
          {detail ? (
            <>
              <FitLine fit={active.elasticFit} range={range} x={x} y={y} />
              <FitLine fit={active.elasticFit} range={range} x={x} y={y} offset={proofOffset} />
              <path className="stress-curve stress-detail-curve" data-stress-detail-curve="" stroke={color}
                d={linePath(detailPoints, x, y)} />
              {active.proof && (
                <circle className="stress-proof" data-stress-proof="" data-strain={active.proof.strain} data-stress={active.proof.stressMpa}
                  cx={x(active.proof.strain)} cy={y(active.proof.stressMpa)} r={4.2} />
              )}
            </>
          ) : (
            results.map((result, index) => (
              <path key={result.id} className="stress-curve" data-stress-curve="" data-condition={result.id}
                data-selected={!compact && index === selected} stroke={colors[index % colors.length]}
                strokeDasharray={dashes[index % dashes.length]} d={linePath(result.points, x, y)} />
            ))
          )}
          {!compact && !detail && (
            <>
              <circle className="stress-ultimate" data-stress-ultimate="" data-strain={active.ultimate.strain} data-stress={active.ultimate.stressMpa}
                cx={x(active.ultimate.strain)} cy={y(active.ultimate.stressMpa)} r={4} />
              <circle className="stress-endpoint" data-stress-endpoint="" data-fracture={active.fracture}
                data-strain={active.endpoint.strain} data-stress={active.endpoint.stressMpa}
                cx={x(active.endpoint.strain)} cy={y(active.endpoint.stressMpa)} r={3.5} />
            </>
          )}
        </g>
      </svg>
    </div>
  )
}

function ComparisonFigure({ analysis, label, compact = false, source }: Omit<StressStrainComparisonProps, 'data' | 'label'> & {
  analysis: NonNullable<ReturnType<typeof analyse>>
  label: string
}) {
  const { results, overview, detail } = analysis
  const [condition, setCondition] = useState(results[0].id)
  const index = Math.max(0, results.findIndex(({ id }) => id === condition))
  const active = results[index]

  return (
    <figure className="stress-strain-comparison" data-stress-strain-comparison="" data-compact={compact}>
      {!compact && results.length > 1 && (
        <label className="stress-condition">Condition
          <select value={active.id} onChange={(event) => setCondition(event.currentTarget.value)}>
            {results.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
      )}
      <TensilePlot label={label} range={overview} results={results} selected={index} mode="overview" compact={compact} />
      {!compact && (
        <>
          <ul className="stress-key" aria-label="Tensile figure key">
            {results.map(({ id, label }, i) => (
              <li key={id}>
                <svg aria-hidden="true" width="22" height="10">
                  <path d="M1 5H21" stroke={colors[i % colors.length]} strokeWidth="1.5" strokeDasharray={dashes[i % dashes.length]} />
                </svg>
                {label}
              </li>
            ))}
            <li className="stress-key-ultimate">Selected tensile maximum</li>
            <li className="stress-key-endpoint">{active.fracture ? 'Selected fracture' : 'Selected recorded endpoint'}</li>
          </ul>
          <TensilePlot label={label} range={detail} results={results} selected={index} mode="detail" />
          <ul className="stress-key stress-detail-key" aria-label="Proof-stress construction key">
            <li className="stress-key-elastic">Elastic fit</li>
            <li className="stress-key-offset">0.2% offset</li>
            <li className="stress-key-proof">Proof stress</li>
          </ul>
          <output className="stress-readout" data-stress-readout="" data-condition={active.id}
            data-modulus={active.elasticFit.modulusMpa} data-proof={active.proof?.stressMpa} data-ultimate={active.ultimate.stressMpa}
            data-end-strain={active.endpoint.strain} data-fracture={active.fracture}>
            <span>Elastic-fit slope <strong>{(active.elasticFit.modulusMpa / 1000).toFixed(1)} GPa</strong></span>
            <span>0.2% proof stress <strong>{active.proof ? `${active.proof.stressMpa.toFixed(1)} MPa` : 'Unavailable'}</strong></span>
            <span>Tensile maximum <strong>{active.ultimate.stressMpa.toFixed(1)} MPa</strong></span>
            <span>{active.fracture ? 'Fracture strain' : 'Recorded endpoint strain'} <strong>{(active.endpoint.strain * 100).toFixed(2)}%</strong></span>
          </output>
          {source && (
            <figcaption className="stress-caption">
              <a href={source.href}>{source.label}</a>
              {source.license && (source.licenseUrl ? <> · <a href={source.licenseUrl}>{source.license}</a></> : ` · ${source.license}`)}
              {source.description && <p>{source.description}</p>}
            </figcaption>
          )}
        </>
      )}
    </figure>
  )
}

export function StressStrainComparison({ data, label = 'Stress–strain comparison', ...props }: StressStrainComparisonProps) {
  const analysis = useMemo(() => analyse(data), [data])
  if (!analysis) return <p className="chart-render-message" role="status">Provide increasing strain samples and a valid elastic fit for each condition.</p>
  return <ComparisonFigure {...props} analysis={analysis} label={label} />
}
