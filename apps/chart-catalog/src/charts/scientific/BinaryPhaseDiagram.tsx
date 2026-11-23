import { useMemo, useState } from 'react'
import type { PointerEvent } from 'react'
import { usePlotSize } from '../usePlotSize'
import './scientific-figure.css'
import './binary-phase-diagram.css'

type Domain = readonly [number, number]
export type AlloyBoundary = 'leftLiquidus' | 'rightLiquidus' | 'leftSolidus' | 'rightSolidus' | 'leftSolvus' | 'rightSolvus'

export interface AlloyBoundaryPoint {
  composition: number
  temperatureC: number
}

export interface AlloyEutectic {
  temperatureC: number
  leftSolid: number
  liquid: number
  rightSolid: number
}

export interface BinaryPhaseDiagramData {
  components: readonly [string, string]
  compositionUnit: 'at. %' | 'wt. %'
  temperatureDomain: Domain
  eutectic: AlloyEutectic
  branches: Readonly<Record<AlloyBoundary, readonly AlloyBoundaryPoint[]>>
}

export interface BinaryPhaseDiagramProps {
  data: BinaryPhaseDiagramData
  label?: string
  compact?: boolean
  initialComposition?: number
  initialTemperatureC?: number
  source?: { label: string; href: string; description?: string; license?: string; licenseUrl?: string }
}

type Region = 'liquid' | 'left-solid' | 'right-solid' | 'left-liquid' | 'right-liquid' | 'two-solids' | 'eutectic' | 'pure-melting'
type Tie = { endpoints: Domain; fractions: Domain }
type State = { region: Region; phases: readonly string[]; tie?: Tie }
const boundaries: readonly AlloyBoundary[] = ['leftLiquidus', 'rightLiquidus', 'leftSolidus', 'rightSolidus', 'leftSolvus', 'rightSolvus']
const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 })

function valid(data: BinaryPhaseDiagramData) {
  const { temperatureDomain: [low, high], eutectic, branches, components, compositionUnit } = data
  if (components.length !== 2 || !components.every((symbol) => symbol.trim()) || components[0] === components[1] ||
      (compositionUnit !== 'at. %' && compositionUnit !== 'wt. %') || !Number.isFinite(high - low) ||
      !(low < eutectic.temperatureC && eutectic.temperatureC < high) ||
      !(0 <= eutectic.leftSolid && eutectic.leftSolid < eutectic.liquid && eutectic.liquid < eutectic.rightSolid && eutectic.rightSolid <= 100)) return false
  return boundaries.every((key) => branches[key].length >= 2 && branches[key].every(({ composition, temperatureC }, index) =>
    Number.isFinite(composition) && composition >= 0 && composition <= 100 &&
    Number.isFinite(temperatureC) && temperatureC >= low && temperatureC <= high &&
    (index === 0 || temperatureC > branches[key][index - 1].temperatureC)))
}

function boundaryAt(points: readonly AlloyBoundaryPoint[], temperature: number) {
  if (temperature < points[0].temperatureC || temperature > points[points.length - 1].temperatureC) return undefined
  let low = 0
  let high = points.length - 1
  while (high - low > 1) {
    const middle = (low + high) >>> 1
    if (points[middle].temperatureC <= temperature) low = middle
    else high = middle
  }
  const [a, b] = [points[low], points[high]]
  const weight = (temperature - a.temperatureC) / (b.temperatureC - a.temperatureC)
  return a.composition + weight * (b.composition - a.composition)
}

function twoPhase(region: Region, phases: readonly [string, string], endpoints: Domain, composition: number): State {
  const fraction = (composition - endpoints[0]) / (endpoints[1] - endpoints[0])
  return { region, phases, tie: { endpoints, fractions: [1 - fraction, fraction] } }
}

function equilibrium(data: BinaryPhaseDiagramData, composition: number, temperature: number): State {
  const { eutectic, branches, components: [a, b] } = data
  const leftPhase = `(${a})`
  const rightPhase = `(${b})`
  if (temperature === eutectic.temperatureC) {
    if (composition <= eutectic.leftSolid) return { region: 'left-solid', phases: [leftPhase] }
    if (composition >= eutectic.rightSolid) return { region: 'right-solid', phases: [rightPhase] }
    return { region: 'eutectic', phases: [leftPhase, 'L', rightPhase] }
  }
  if (temperature < eutectic.temperatureC) {
    const left = boundaryAt(branches.leftSolvus, temperature) ?? branches.leftSolvus[0].composition
    const right = boundaryAt(branches.rightSolvus, temperature) ?? branches.rightSolvus[0].composition
    if (composition <= left) return { region: 'left-solid', phases: [leftPhase] }
    if (composition >= right) return { region: 'right-solid', phases: [rightPhase] }
    return twoPhase('two-solids', [leftPhase, rightPhase], [left, right], composition)
  }
  const leftSolid = boundaryAt(branches.leftSolidus, temperature)
  const leftLiquid = boundaryAt(branches.leftLiquidus, temperature)
  const rightSolid = boundaryAt(branches.rightSolidus, temperature)
  const rightLiquid = boundaryAt(branches.rightLiquidus, temperature)
  if (leftSolid !== undefined && leftLiquid !== undefined) {
    if (composition === 0 && leftSolid === 0 && leftLiquid === 0) return { region: 'pure-melting', phases: [leftPhase, 'L'] }
    if (composition <= leftSolid) return { region: 'left-solid', phases: [leftPhase] }
    if (composition < leftLiquid) return twoPhase('left-liquid', [leftPhase, 'L'], [leftSolid, leftLiquid], composition)
  }
  if (rightSolid !== undefined && rightLiquid !== undefined) {
    if (composition === 100 && rightSolid === 100 && rightLiquid === 100) return { region: 'pure-melting', phases: ['L', rightPhase] }
    if (composition >= rightSolid) return { region: 'right-solid', phases: [rightPhase] }
    if (composition > rightLiquid) return twoPhase('right-liquid', ['L', rightPhase], [rightLiquid, rightSolid], composition)
  }
  return { region: 'liquid', phases: ['L'] }
}

function bound(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function temperatureTicks([min, max]: Domain, target: number) {
  const approximate = (max - min) / target
  const base = 10 ** Math.floor(Math.log10(approximate))
  const step = base * ([1, 2, 2.5, 5, 10].find((multiple) => base * multiple >= approximate) ?? 10)
  if (!Number.isFinite(step) || !(step > 0)) return [min, max]
  const first = Math.ceil(min / step)
  const last = Math.floor(max / step)
  return last > first ? Array.from({ length: Math.min(10, last - first + 1) }, (_, i) => (first + i) * step) : [min, max]
}

function regionLabels(data: BinaryPhaseDiagramData, width: number) {
  const { eutectic, components: [a, b], temperatureDomain: [low, high], branches } = data
  const liquidTemperature = eutectic.temperatureC + (high - eutectic.temperatureC) * .72
  const liquidLeft = boundaryAt(branches.leftLiquidus, liquidTemperature) ?? 0
  const liquidRight = boundaryAt(branches.rightLiquidus, liquidTemperature) ?? 100
  const solidTemperature = low + (eutectic.temperatureC - low) * .52
  const leftSolvus = boundaryAt(branches.leftSolvus, solidTemperature) ?? eutectic.leftSolid
  const rightSolvus = boundaryAt(branches.rightSolvus, solidTemperature) ?? eutectic.rightSolid
  const labels = [
    { text: 'L', composition: (liquidLeft + liquidRight) / 2, temperatureC: liquidTemperature },
    { text: `(${a}) + (${b})`, composition: (leftSolvus + rightSolvus) / 2, temperatureC: solidTemperature },
  ]
  if (width < 400) return labels
  const left = branches.leftLiquidus[branches.leftLiquidus.length - 1].temperatureC
  const right = branches.rightLiquidus[branches.rightLiquidus.length - 1].temperatureC
  const leftTemperature = eutectic.temperatureC + (left - eutectic.temperatureC) * .24
  const rightTemperature = eutectic.temperatureC + (right - eutectic.temperatureC) * .41
  const leftSolid = boundaryAt(branches.leftSolidus, leftTemperature)
  const leftLiquid = boundaryAt(branches.leftLiquidus, leftTemperature)
  const rightSolid = boundaryAt(branches.rightSolidus, rightTemperature)
  const rightLiquid = boundaryAt(branches.rightLiquidus, rightTemperature)
  if (leftSolid !== undefined && leftLiquid !== undefined) labels.push({
    text: `(${a}) + L`, composition: (leftSolid + leftLiquid) / 2, temperatureC: leftTemperature,
  })
  if (rightSolid !== undefined && rightLiquid !== undefined) labels.push({
    text: `L + (${b})`, composition: (rightSolid + rightLiquid) / 2, temperatureC: rightTemperature,
  })
  const pureTemperature = eutectic.temperatureC - (eutectic.temperatureC - low) * .045
  const leftLimit = boundaryAt(branches.leftSolvus, pureTemperature) ?? eutectic.leftSolid
  const rightLimit = boundaryAt(branches.rightSolvus, pureTemperature) ?? eutectic.rightSolid
  if (leftLimit / 100 * width > 31) labels.push({ text: `(${a})`, composition: leftLimit / 2, temperatureC: pureTemperature })
  if ((100 - rightLimit) / 100 * width > 24) labels.push({ text: `(${b})`, composition: (rightLimit + 100) / 2, temperatureC: pureTemperature })
  return labels
}

function PhasePlot({ data, composition, temperature, state, compact, label, choose }: {
  data: BinaryPhaseDiagramData
  composition: number
  temperature: number
  state: State
  compact: boolean
  label: string
  choose: (composition: number, temperature: number) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 432 : 775, compact ? 174 : 360)
  const left = width < 350 ? 51 : 62
  const right = Math.max(left + 1, width - 24)
  const top = 16
  const bottom = Math.max(top + 1, height - 43)
  const [low, high] = data.temperatureDomain
  const { eutectic, components: [a, b] } = data
  const x = (value: number) => left + value / 100 * (right - left)
  const y = (value: number) => bottom - (value - low) / (high - low) * (bottom - top)
  const cursorX = x(composition)
  const cursorY = y(temperature)
  const eutecticY = y(eutectic.temperatureC)
  const labelComposition = `Composition (${data.compositionUnit} ${b})`

  function choosePoint(event: PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const xFraction = bound((event.clientX - rect.left) / rect.width, 0, 1)
    const yFraction = bound((event.clientY - rect.top) / rect.height, 0, 1)
    choose(Math.round(xFraction * 1000) / 10, Math.round((high - yFraction * (high - low)) * 10) / 10)
  }

  return (
    <div className="alloy-plot scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" data-phase-diagram=""
        aria-label={`${label}. Temperature versus ${b} content, with calculated equilibrium phase boundaries.`}>
        <g className="scientific-axis" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => index * 20).map((value) => (
            <g key={value}>
              <line className="alloy-grid" x1={x(value)} x2={x(value)} y1={top} y2={bottom} />
              <line className="scientific-tick" x1={x(value)} x2={x(value)} y1={bottom} y2={bottom + 4} />
              <text x={x(value)} y={bottom + 17} textAnchor="middle">{value}</text>
            </g>
          ))}
          {temperatureTicks(data.temperatureDomain, compact ? 4 : 6).map((value) => (
            <g key={value}>
              <line className="alloy-grid" x1={left} x2={right} y1={y(value)} y2={y(value)} />
              <line className="scientific-tick" x1={left - 4} x2={left} y1={y(value)} y2={y(value)} />
              <text x={left - 8} y={y(value) + 4} textAnchor="end">{format.format(value)}</text>
            </g>
          ))}
          <rect className="scientific-frame" data-phase-diagram-frame="" x={left} y={top} width={right - left} height={bottom - top} />
          <text className="scientific-axis-label" x={(left + right) / 2} y={height - 6} textAnchor="middle">{labelComposition}</text>
          <text className="scientific-axis-label" textAnchor="middle" transform={`translate(13 ${(top + bottom) / 2}) rotate(-90)`}>Temperature (°C)</text>
          <text x={left} y={height - 6} textAnchor="middle">{a}</text>
          <text x={right} y={height - 6} textAnchor="middle">{b}</text>
          <line className="alloy-eutectic" data-alloy-eutectic="" data-temperature={eutectic.temperatureC}
            x1={x(eutectic.leftSolid)} x2={x(eutectic.rightSolid)} y1={eutecticY} y2={eutecticY} />
          {boundaries.map((key) => (
            <path key={key} className="alloy-boundary" data-alloy-boundary="" data-boundary={key}
              d={data.branches[key].map(({ composition, temperatureC }, i) =>
                `${i ? 'L' : 'M'}${x(composition).toFixed(2)} ${y(temperatureC).toFixed(2)}`).join(' ')} />
          ))}
          <circle className="alloy-eutectic-point" cx={x(eutectic.liquid)} cy={eutecticY} r={3} />
          {regionLabels(data, right - left).map(({ text, composition, temperatureC }) => (
            <text key={text} className="alloy-region" x={x(composition)} y={y(temperatureC)}
              textAnchor="middle" dominantBaseline="central">{text}</text>
          ))}
          {!compact && (
            <>
              <line className="alloy-cooling" data-alloy-cooling="" x1={cursorX} x2={cursorX} y1={top} y2={bottom} />
              {state.tie && (
                <>
                  <line className="alloy-tie-line" data-alloy-tie-line="" data-left={state.tie.endpoints[0]} data-right={state.tie.endpoints[1]}
                    x1={x(state.tie.endpoints[0])} x2={x(state.tie.endpoints[1])} y1={cursorY} y2={cursorY} />
                  {state.tie.endpoints.map((endpoint) => <circle key={endpoint} className="alloy-tie-end" cx={x(endpoint)} cy={cursorY} r={3.4} />)}
                </>
              )}
              <circle className="alloy-cursor" data-alloy-cursor="" cx={cursorX} cy={cursorY} r={4.6} />
            </>
          )}
        </g>
        {!compact && (
          <rect className="alloy-plot-pick" fill="transparent" x={left} y={top} width={right - left} height={bottom - top}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              choosePoint(event)
            }} onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) choosePoint(event)
            }} />
        )}
      </svg>
    </div>
  )
}

function PhaseFigure({ data, label, compact = false, initialComposition, initialTemperatureC, source }: BinaryPhaseDiagramProps & { label: string }) {
  const { eutectic, temperatureDomain: [low, high], components: [, solute] } = data
  const [bulk, setComposition] = useState(initialComposition !== undefined && Number.isFinite(initialComposition) ? initialComposition : eutectic.liquid)
  const [selectedTemperature, setTemperature] = useState(initialTemperatureC !== undefined && Number.isFinite(initialTemperatureC)
    ? initialTemperatureC : (high + eutectic.temperatureC) / 2)
  const composition = bound(bulk, 0, 100)
  const temperature = bound(selectedTemperature, low, high)
  const state = equilibrium(data, composition, temperature)
  const fractionLabel = data.compositionUnit === 'at. %' ? 'Mole fraction' : 'Mass fraction'
  const { tie } = state
  const [left, right] = tie?.fractions ?? []
  const phaseCompositions = state.region === 'eutectic' ? [eutectic.leftSolid, eutectic.liquid, eutectic.rightSolid] : tie?.endpoints

  function choose(composition: number, temperature: number) {
    setComposition(composition)
    setTemperature(temperature)
  }

  return (
    <figure className="binary-phase-diagram" data-binary-phase-diagram="" data-compact={compact}>
      <PhasePlot data={data} composition={composition} temperature={temperature} state={state} compact={compact} label={label} choose={choose} />
      {!compact && (
        <>
          <ul className="alloy-key" aria-label="Equilibrium diagram key">
            <li className="alloy-key-boundary">Phase boundary</li>
            <li className="alloy-key-path">Cooling path</li>
            <li className="alloy-key-tie">Tie line</li>
            <li className="alloy-key-eutectic">Eutectic point</li>
          </ul>
          <div className="alloy-controls">
            <label>Composition
              <input type="range" min={0} max={100} step={.1} value={composition}
                aria-valuetext={`${format.format(composition)} ${data.compositionUnit} ${solute}`}
                onChange={(event) => setComposition(Number(event.currentTarget.value))} />
            </label>
            <label>Temperature
              <input type="range" min={low} max={high} step={.1} value={temperature}
                aria-valuetext={`${format.format(temperature)} °C`} onChange={(event) => setTemperature(Number(event.currentTarget.value))} />
            </label>
            <button type="button" onClick={() => choose(eutectic.liquid, eutectic.temperatureC)}>Go to eutectic</button>
          </div>
          <output className="alloy-readout" data-alloy-readout="" data-composition={composition} data-temperature={temperature}
            data-region={state.region} data-left-fraction={left} data-right-fraction={right}>
            <span>Composition <strong>{format.format(composition)} {data.compositionUnit} {solute}</strong></span>
            <span>Temperature <strong>{format.format(temperature)} °C</strong></span>
            <span>Equilibrium phases <strong>{state.phases.join(' + ')}</strong></span>
            {phaseCompositions && <span>Phase compositions ({data.compositionUnit} {solute}) <strong>
              {state.phases.map((phase, i) => `${phase} ${format.format(phaseCompositions[i])}`).join(' · ')}
            </strong></span>}
            {tie && <span>{fractionLabel} <strong>{state.phases.map((phase, i) => `${phase} ${percent.format(tie.fractions[i])}`).join(' · ')}</strong></span>}
            {(state.region === 'eutectic' || state.region === 'pure-melting') && <span>Phase amounts <strong>Undetermined at this invariant</strong></span>}
          </output>
          {source && (
            <figcaption className="alloy-caption">
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

export function BinaryPhaseDiagram({ data, label = 'Binary alloy phase diagram', ...props }: BinaryPhaseDiagramProps) {
  const usable = useMemo(() => valid(data), [data])
  if (!usable) return <p className="chart-render-message" role="status">Provide ordered eutectic phase boundaries and a valid temperature domain.</p>
  return <PhaseFigure {...props} data={data} label={label} />
}
