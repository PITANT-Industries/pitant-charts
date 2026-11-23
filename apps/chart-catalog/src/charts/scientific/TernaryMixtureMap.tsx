import { useEffect, useId, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { usePlotSize } from '../usePlotSize'
import './scientific-figure.css'
import './ternary-mixture-map.css'

export type MixtureFractions = readonly [number, number, number]
export type MixtureModel = readonly [number, number, number, number, number, number, number?]

export interface MixtureObservation {
  id: string
  fractions: MixtureFractions
  value: number
}

export interface TernaryMixtureData {
  components: readonly [string, string, string]
  shortComponents?: readonly [string, string, string]
  responseLabel: string
  responseUnit: string
  observations: readonly MixtureObservation[]
  model: MixtureModel
  colorDomain: readonly [number, number]
}

export interface TernaryMixtureMapProps {
  data: TernaryMixtureData
  label?: string
  compact?: boolean
  initialFractions?: MixtureFractions
  source?: { label: string; href: string; description?: string; license?: string; licenseUrl?: string }
}

type Point = readonly [number, number]
type Segment = readonly [Point, Point]
type Basis = { minima: MixtureFractions; span: number }
type Field = { hull: readonly Point[]; levels: readonly number[]; focus?: Basis }
const equilateralHeight = Math.sqrt(3) / 2
const tolerance = 1e-8
const fullBasis: Basis = { minima: [0, 0, 0], span: 1 }
const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const palette = [
  [68, 1, 84], [71, 44, 122], [59, 81, 139], [44, 113, 142], [33, 144, 141],
  [39, 173, 129], [92, 200, 99], [170, 220, 50], [253, 231, 37],
] as const

function isMixture(fractions: MixtureFractions) {
  return fractions.length === 3 && fractions.every((part) => Number.isFinite(part) && part >= 0 && part <= 1) &&
    Math.abs(fractions[0] + fractions[1] + fractions[2] - 1) <= tolerance
}

function position([a, , c]: MixtureFractions): Point {
  return [c + a / 2, a]
}

function displayPosition([x, y]: Point, basis: Basis): Point {
  const origin = position(basis.minima)
  return [(x - origin[0]) / basis.span, (y - origin[1]) / basis.span]
}

function physicalFractions([a, b, c]: MixtureFractions, { minima, span }: Basis): MixtureFractions {
  return [minima[0] + span * a, minima[1] + span * b, minima[2] + span * c]
}

function insideBasis(fractions: MixtureFractions, { minima }: Basis) {
  return fractions.every((part, index) => part >= minima[index] - tolerance)
}

function turn(a: Point, b: Point, c: Point) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}

function convexHull(observations: readonly MixtureObservation[]) {
  const points = observations.map(({ fractions }) => position(fractions)).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  function halfPath(order: readonly Point[]) {
    const chain: Point[] = []
    for (const point of order) {
      while (chain.length > 1 && turn(chain[chain.length - 2], chain[chain.length - 1], point) <= tolerance) chain.pop()
      chain.push(point)
    }
    return chain.slice(0, -1)
  }
  return [...halfPath(points), ...halfPath(points.reverse())]
}

function supported(hull: readonly Point[], point: Point) {
  return hull.every((vertex, index) => turn(vertex, hull[(index + 1) % hull.length], point) >= -tolerance)
}

function response([a, b, c]: MixtureFractions, [ma, mb, mc, mab, mac, mbc, mabc = 0]: MixtureModel) {
  return ma * a + mb * b + mc * c + mab * a * b + mac * a * c + mbc * b * c + mabc * a * b * c
}

function blend(a: number, b: number, weight: number) {
  return a + (b - a) * weight
}

function isoSegments(model: MixtureModel, levels: readonly number[], basis: Basis) {
  const resolution = 52
  const result: Segment[] = []
  const nodes = Array.from({ length: resolution + 1 }, (_, row) =>
    Array.from({ length: resolution - row + 1 }, (_, column) => {
      const a = row / resolution
      const c = column / resolution
      const fractions = [a, 1 - a - c, c] as const
      return { xy: position(fractions), z: response(physicalFractions(fractions, basis), model) }
    }))
  type Node = typeof nodes[number][number]
  function contour(first: Node, second: Node, third: Node) {
    const triangle = [first, second, third]
    for (const level of levels) {
      const crossings: Point[] = []
      for (let i = 0; i < 3; i++) {
        const a = triangle[i]
        const b = triangle[(i + 1) % 3]
        if ((a.z >= level) === (b.z >= level)) continue
        const weight = (level - a.z) / (b.z - a.z)
        crossings.push([blend(a.xy[0], b.xy[0], weight), blend(a.xy[1], b.xy[1], weight)])
      }
      if (crossings.length === 2) result.push([crossings[0], crossings[1]])
    }
  }
  for (let row = 0; row < resolution; row++) {
    for (let column = 0; column < resolution - row; column++) {
      contour(nodes[row][column], nodes[row + 1][column], nodes[row][column + 1])
      if (column + row + 2 <= resolution) {
        contour(nodes[row + 1][column], nodes[row + 1][column + 1], nodes[row][column + 1])
      }
    }
  }
  return result
}

function fieldFor(data: TernaryMixtureData): Field | null {
  const { observations, model, colorDomain: [low, high], components } = data
  if (components.length !== 3 || new Set(components).size !== 3 || !components.every((name) => name.trim()) ||
    observations.length < 3 || new Set(observations.map(({ id }) => id)).size !== observations.length ||
    !observations.every(({ fractions, value }) => isMixture(fractions) && Number.isFinite(value)) ||
    (model.length !== 6 && model.length !== 7) || !model.every(Number.isFinite) || !(high > low) || !Number.isFinite(high - low)) return null
  const hull = convexHull(observations)
  if (hull.length < 3) return null
  const levels = [low, blend(low, high, .25), blend(low, high, .5), blend(low, high, .75), high]
  const minima = [1, 1, 1] as [number, number, number]
  for (const { fractions } of observations) {
    fractions.forEach((part, index) => { minima[index] = Math.min(minima[index], part) })
  }
  const span = 1 - minima[0] - minima[1] - minima[2]
  return { hull, levels, focus: span < .72 && span > tolerance ? { minima, span } : undefined }
}

function rasterFor(data: TernaryMixtureData, hull: readonly Point[], basis: Basis) {
  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = Math.round(canvas.width * equilateralHeight)
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined
  const rgba = ctx.createImageData(canvas.width, canvas.height)
  const [min, max] = data.colorDomain
  let offset = 0
  for (let row = 0; row < canvas.height; row++) {
    const a = 1 - (row + .5) / canvas.height
    for (let column = 0; column < canvas.width; column++) {
      const x = (column + .5) / canvas.width
      if (supported(hull, [x, a])) {
        const c = x - a / 2
        const z = response(physicalFractions([a, 1 - a - c, c], basis), data.model)
        const level = Math.max(0, Math.min(1, (z - min) / (max - min))) * (palette.length - 1)
        const stop = Math.min(palette.length - 2, Math.floor(level))
        for (let channel = 0; channel < 3; channel++) {
          rgba.data[offset + channel] = blend(palette[stop][channel], palette[stop + 1][channel], level - stop)
        }
        rgba.data[offset + 3] = 255
      }
      offset += 4
    }
  }
  ctx.putImageData(rgba, 0, 0)
  return canvas.toDataURL('image/png')
}

function normalize([a, b, c]: MixtureFractions): MixtureFractions {
  const aa = Math.max(0, a)
  const bb = Math.max(0, b)
  const cc = Math.max(0, c)
  const total = aa + bb + cc
  return [aa / total, bb / total, cc / total]
}

function TernaryPlot({ data, field, basis, selected, label, compact, choose, observe }: {
  data: TernaryMixtureData
  field: Field
  basis: Basis
  selected: MixtureFractions
  label: string
  compact: boolean
  choose: (fractions: MixtureFractions) => void
  observe: (observation: MixtureObservation) => void
}) {
  const gradient = useId()
  const clip = useId()
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 433 : 760, compact ? 187 : 375)
  const hull = useMemo(() => field.hull.map((point) => displayPosition(point, basis)), [field, basis])
  const contourSegments = useMemo(() => isoSegments(data.model, field.levels.slice(1, -1), basis), [data.model, field, basis])
  const [image, setImage] = useState<{ hull: readonly Point[]; href?: string }>()
  useEffect(() => {
    setImage({ hull, href: rasterFor(data, hull, basis) })
  }, [data, hull, basis])
  const available = Math.max(1, width - (width < 350 ? (compact ? 108 : 125) : 141))
  const side = Math.min(available, Math.max(1, (height - (compact ? 63 : 82)) / equilateralHeight))
  const left = 30 + (available - side) / 2
  const right = left + side
  const bottom = height - (compact ? 37 : 45)
  const triangleHeight = side * equilateralHeight
  const top = bottom - triangleHeight
  const x = (point: Point) => left + side * point[0]
  const y = (point: Point) => bottom - triangleHeight * point[1]
  const path = (points: readonly Point[]) => points.map((point, index) =>
    `${index ? 'L' : 'M'}${x(point).toFixed(2)} ${y(point).toFixed(2)}`).join(' ')
  const simplex = `${path([[.5, 1], [0, 0], [1, 0]])}Z`
  const supportPath = `${path(hull)}Z`
  const contours = contourSegments.map((segment) => path(segment)).join(' ')
  const selection = displayPosition(position(selected), basis)
  const labels = data.shortComponents ?? data.components
  const percentage = (part: number, component: number) => format.format((basis.minima[component] + part * basis.span) * 100)
  const vertexLabel = (component: number) => basis === fullBasis ? labels[component] : `${labels[component]} ${percentage(1, component)}%`
  const rangeLabel = data.responseUnit ? `${data.responseLabel} (${data.responseUnit})` : data.responseLabel
  const colorX = right + (compact ? 18 : 22)
  const colorWidth = 11
  const step = side < 115 ? [.25, .5, .75] : [.2, .4, .6, .8]

  function pick(event: MouseEvent<SVGPathElement>) {
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const xx = (event.clientX - rect.left) * width / rect.width
    const yy = (event.clientY - rect.top) * height / rect.height
    const a = (bottom - yy) / triangleHeight
    const c = (xx - left) / side - a / 2
    choose(physicalFractions(normalize([a, 1 - a - c, c]), basis))
  }

  return (
    <div className="ternary-plot scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" data-ternary-plot="" data-span={basis.span}
        data-a-min={basis.minima[0]} data-b-min={basis.minima[1]} data-c-min={basis.minima[2]}
        aria-label={`${label}. Ternary composition in percent, with measured mixtures and a fitted ${data.responseLabel.toLowerCase()} surface.`}>
        <defs>
          <clipPath id={clip}><path d={supportPath} /></clipPath>
          <linearGradient id={gradient} x1="0%" x2="0%" y1="100%" y2="0%">
            {palette.map((color, index) => <stop key={index} offset={index / (palette.length - 1)} stopColor={`rgb(${color.join(' ')})`} />)}
          </linearGradient>
        </defs>
        {image?.hull === hull && image.href && <image data-ternary-surface="" href={image.href} x={left} y={top}
          width={side} height={triangleHeight} preserveAspectRatio="none" aria-hidden="true" />}
        <g className="scientific-axis" aria-hidden="true">
          {step.map((part) => {
            const a = position([part, 1 - part, 0])
            const b = position([0, part, 1 - part])
            const c = position([1 - part, 0, part])
            return (
              <g key={part}>
                <path className="ternary-grid" d={path([a, position([part, 0, 1 - part])])} />
                <path className="ternary-grid" d={path([b, position([1 - part, part, 0])])} />
                <path className="ternary-grid" d={path([c, position([0, 1 - part, part])])} />
                <line className="scientific-tick" x1={x(a)} x2={x(a) - 4} y1={y(a)} y2={y(a) - 2} />
                <text x={x(a) - 7} y={y(a) + 2} textAnchor="end">{percentage(part, 0)}</text>
                <line className="scientific-tick" x1={x(b)} x2={x(b)} y1={bottom} y2={bottom + 4} />
                <text x={x(b)} y={bottom + 16} textAnchor="middle">{percentage(part, 1)}</text>
                <line className="scientific-tick" x1={x(c)} x2={x(c) + 4} y1={y(c)} y2={y(c) - 2} />
                <text x={x(c) + 7} y={y(c) + 2}>{percentage(part, 2)}</text>
              </g>
            )
          })}
          <path className="scientific-frame" data-ternary-simplex="" d={simplex} />
          <path className="ternary-support" data-ternary-support="" d={supportPath} />
          <path className="ternary-contours" d={contours} clipPath={`url(#${clip})`} />
          <text className="scientific-panel-title" x={(left + right) / 2} y={top - 9} textAnchor="middle">{vertexLabel(0)}</text>
          <text className="scientific-panel-title" x={left} y={bottom + 31} textAnchor="middle">{vertexLabel(1)}</text>
          <text className="scientific-panel-title" x={right} y={bottom + 31} textAnchor="middle">{vertexLabel(2)}</text>
          {!compact && <text x={(left + right) / 2} y={height - 7} textAnchor="middle">Composition (%)</text>}
          <g data-ternary-colorbar="" data-min={data.colorDomain[0]} data-max={data.colorDomain[1]}>
            <rect x={colorX} y={top} width={colorWidth} height={triangleHeight} fill={`url(#${gradient})`} />
            <rect className="scientific-frame" x={colorX} y={top} width={colorWidth} height={triangleHeight} />
            {(triangleHeight < 140 ? field.levels.filter((_, index) => index % 2 === 0) : field.levels).map((level) => {
              const yy = bottom - (level - data.colorDomain[0]) / (data.colorDomain[1] - data.colorDomain[0]) * triangleHeight
              return (
                <g key={level}>
                  <line className="scientific-tick" x1={colorX + colorWidth} x2={colorX + colorWidth + 4} y1={yy} y2={yy} />
                  <text x={colorX + colorWidth + 7} y={yy + 4}>{format.format(level)}</text>
                </g>
              )
            })}
            <text className="scientific-axis-label ternary-color-label" textAnchor="middle"
              transform={`translate(${colorX + (compact ? 45 : 58)} ${(top + bottom) / 2}) rotate(-90)`}>{rangeLabel}</text>
          </g>
        </g>
        {!compact && <path className="ternary-pick" fill="transparent" d={simplex} onClick={pick} />}
        {data.observations.map((observation) => {
          const point = displayPosition(position(observation.fractions), basis)
          const [a, b, c] = observation.fractions
          return (
            <circle key={observation.id} className="ternary-observation" data-ternary-observation=""
              data-id={observation.id} data-a={a} data-b={b} data-c={c} data-value={observation.value}
              cx={x(point)} cy={y(point)} r={compact ? 2.65 : 3.8} aria-hidden="true"
              onClick={compact ? undefined : () => observe(observation)} />
          )
        })}
        {!compact && insideBasis(selected, basis) && <circle className="ternary-cursor" data-ternary-cursor=""
          cx={x(selection)} cy={y(selection)} r={6.8} aria-hidden="true" />}
      </svg>
    </div>
  )
}

function MixtureFigure({ data, field, label, compact = false, source, initialFractions }: TernaryMixtureMapProps & { field: Field; label: string }) {
  const initial = initialFractions && isMixture(initialFractions) ? initialFractions : data.observations[0].fractions
  const [selection, setSelection] = useState<{ fractions: MixtureFractions; id?: string }>(() => ({
    fractions: initial, id: data.observations.find(({ fractions }) => fractions.every((value, i) => value === initial[i]))?.id,
  }))
  const [showFull, setShowFull] = useState(() => Boolean(field.focus && !insideBasis(initial, field.focus)))
  const { fractions, id } = selection
  const [a, b, c] = fractions
  const basis = showFull || !field.focus ? fullBasis : field.focus
  const observation = data.observations.find((observation) =>
    observation.id === id && observation.fractions.every((part, index) => part === fractions[index]))
  const prediction = supported(field.hull, position(fractions)) ? response(fractions, data.model) : undefined
  const responseLabel = data.responseUnit ? ` ${data.responseUnit}` : ''
  function observe(observation: MixtureObservation) {
    setSelection({ fractions: observation.fractions, id: observation.id })
  }

  function choose(fractions: MixtureFractions) {
    setSelection({ fractions })
    if (field.focus && !insideBasis(fractions, field.focus)) setShowFull(true)
  }

  function setA(next: number) {
    const second = Math.min(b, 1 - next)
    choose([next, second, 1 - next - second])
  }

  function setB(next: number) {
    const second = Math.min(next, 1 - a)
    choose([a, second, 1 - a - second])
  }

  return (
    <figure className="ternary-mixture" data-ternary-mixture="" data-compact={compact}>
      <TernaryPlot data={data} field={field} basis={basis} selected={fractions} label={label} compact={compact} choose={choose} observe={observe} />
      {!compact && (
        <>
          <ul className="ternary-key" aria-label="Mixture map key">
            <li className="ternary-key-observed">Measured mixture</li>
            <li className="ternary-key-model">Fitted response</li>
            <li className="ternary-key-limit">Sampled mixture region</li>
          </ul>
          {field.focus && (
            <label className="ternary-full-choice">
              <input type="checkbox" checked={showFull} onChange={(event) => setShowFull(event.currentTarget.checked)} />
              Show full composition triangle
            </label>
          )}
          <div className="ternary-controls">
            <label>{data.components[0]}
              <input type="range" min={0} max={100} step={.1} value={a * 100}
                aria-valuetext={`${format.format(a * 100)}%`} onChange={(event) => setA(Number(event.currentTarget.value) / 100)} />
            </label>
            <label>{data.components[1]}
              <input type="range" min={0} max={(1 - a) * 100} step={.1} value={b * 100}
                aria-valuetext={`${format.format(b * 100)}%`} onChange={(event) => setB(Number(event.currentTarget.value) / 100)} />
            </label>
            <label>Observation
              <select value={observation?.id ?? ''} onChange={(event) => {
                const next = data.observations.find(({ id }) => id === event.currentTarget.value)
                if (next) observe(next)
              }}>
                <option value="" disabled>Custom mixture</option>
                {data.observations.map(({ id }) => <option key={id} value={id}>{id}</option>)}
              </select>
            </label>
          </div>
          <output className="ternary-readout" data-ternary-readout="" data-a={a} data-b={b} data-c={c} data-id={observation?.id}
            data-observed={observation?.value} data-prediction={prediction}>
            {data.components.map((component, index) => <span key={component}>{component} <strong>{format.format(fractions[index] * 100)}%</strong></span>)}
            <span>Fitted response <strong>{prediction === undefined ? 'Outside sampled region' : `${format.format(prediction)}${responseLabel}`}</strong></span>
            {observation && <span>Measured response <strong>{format.format(observation.value)}{responseLabel}</strong></span>}
          </output>
          {source && (
            <figcaption className="ternary-caption">
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

export function TernaryMixtureMap({ data, label = 'Ternary mixture map', ...props }: TernaryMixtureMapProps) {
  const field = useMemo(() => fieldFor(data), [data])
  if (!field) return <p className="chart-render-message" role="status">Provide three-part mixtures, a fitted response model, and a non-collinear set of observations.</p>
  return <MixtureFigure {...props} data={data} field={field} label={label} />
}
