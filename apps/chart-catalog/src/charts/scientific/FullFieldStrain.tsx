import { useEffect, useId, useMemo, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { usePlotSize } from '../usePlotSize'
import './scientific-figure.css'
import './full-field-strain.css'

type Domain = readonly [number, number]

export interface StrainForceSample {
  stage: number
  forceN: number
}

export interface StrainFieldFrame extends StrainForceSample {
  strainPercent: readonly (number | null)[]
}

export interface FullFieldStrainData {
  xMm: readonly number[]
  yMm: readonly number[]
  componentLabel: string
  stageLabel: string
  stageUnit?: string
  strainDomainPercent: Domain
  frames: readonly StrainFieldFrame[]
  forceHistory?: readonly StrainForceSample[]
}

export interface FullFieldStrainProps {
  data: FullFieldStrainData
  label?: string
  compact?: boolean
  initialStage?: number
  source?: { label: string; href: string; description?: string; license?: string; licenseUrl?: string }
}

type Probe = readonly [column: number, row: number]
type Frame = { left: number; right: number; top: number; bottom: number }
const palette = [
  [68, 1, 84], [71, 44, 122], [59, 81, 139], [44, 113, 142], [33, 144, 141],
  [39, 173, 129], [92, 200, 99], [170, 220, 50], [253, 231, 37],
] as const
const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })

function extent(values: readonly number[]): Domain {
  return [values[0], values[values.length - 1]]
}

function ordered(values: readonly number[]) {
  return values.length >= 2 && values.every((value, index) =>
    Number.isFinite(value) && (index === 0 || value > values[index - 1])) &&
    Number.isFinite(values[values.length - 1] - values[0])
}

function getDomains(data: FullFieldStrainData) {
  const { xMm, yMm, frames, forceHistory, strainDomainPercent: [low, high] } = data
  const stages = frames.map(({ stage }) => stage)
  if (!ordered(xMm) || !ordered(yMm) || !ordered(stages) || !Number.isFinite(high - low) || high <= low) return null
  if (!frames.every(({ forceN, strainPercent }) => Number.isFinite(forceN) &&
      strainPercent.length === xMm.length * yMm.length &&
      strainPercent.every((value) => value === null || Number.isFinite(value)))) return null
  const forceSamples = forceHistory ?? frames
  const forceStages = forceSamples.map(({ stage }) => stage)
  if (!ordered(forceStages) || forceStages[0] > stages[0] || forceStages[forceStages.length - 1] < stages[stages.length - 1]) return null
  let minForce = 0
  let maxForce = 0
  for (const { forceN } of forceSamples) {
    if (!Number.isFinite(forceN)) return null
    minForce = Math.min(minForce, forceN)
    maxForce = Math.max(maxForce, forceN)
  }
  for (const { forceN } of frames) {
    minForce = Math.min(minForce, forceN)
    maxForce = Math.max(maxForce, forceN)
  }
  const padding = (maxForce - minForce || 1) * .08
  if (!Number.isFinite(maxForce - minForce + 2 * padding)) return null
  return {
    x: extent(xMm), y: extent(yMm), stages, forceSamples, stage: extent(forceStages),
    force: [minForce === 0 ? 0 : minForce - padding, maxForce + padding] as const,
  }
}

function blend(a: number, b: number, weight: number) {
  return a + (b - a) * weight
}

function scale(value: number, [min, max]: Domain, start: number, end: number) {
  return blend(start, end, (value - min) / (max - min))
}

function precedingIndex(values: readonly number[], value: number) {
  let low = 0
  let high = values.length - 1
  while (high - low > 1) {
    const middle = (low + high) >>> 1
    if (values[middle] <= value) low = middle
    else high = middle
  }
  return low
}

function closestIndex(values: readonly number[], value: number) {
  const first = precedingIndex(values, value)
  return value - values[first] <= values[first + 1] - value ? first : first + 1
}

function ticks([low, high]: Domain, count: number) {
  const approximate = (high - low) / count
  const base = 10 ** Math.floor(Math.log10(approximate))
  const step = base * ([1, 2, 2.5, 5, 10].find((multiple) => base * multiple >= approximate) ?? 10)
  if (!Number.isFinite(step) || !(step > 0)) return [low, high]
  const start = Math.ceil(low / step)
  const end = Math.floor(high / step)
  return end > start ? Array.from({ length: Math.min(12, end - start + 1) }, (_, index) => (start + index) * step) : [low, high]
}

function pixels(values: readonly number[], count: number, reverse = false) {
  const [min, max] = extent(values)
  return Array.from({ length: count }, (_, index) => {
    const ratio = (index + .5) / count
    const value = blend(min, max, reverse ? 1 - ratio : ratio)
    const lower = precedingIndex(values, value)
    return { lower, weight: (value - values[lower]) / (values[lower + 1] - values[lower]) }
  })
}

function fieldImage(data: FullFieldStrainData, frame: StrainFieldFrame) {
  const canvas = document.createElement('canvas')
  const x = extent(data.xMm)
  const y = extent(data.yMm)
  const aspect = (x[1] - x[0]) / (y[1] - y[0])
  canvas.width = Math.max(2, Math.round(720 * Math.min(1, aspect)))
  canvas.height = Math.max(2, Math.round(720 * Math.min(1, 1 / aspect)))
  const context = canvas.getContext('2d')
  if (!context) return undefined
  const raster = context.createImageData(canvas.width, canvas.height)
  const columns = pixels(data.xMm, canvas.width)
  const rows = pixels(data.yMm, canvas.height, true)
  const values = frame.strainPercent
  const columnsCount = data.xMm.length
  const [minimum, maximum] = data.strainDomainPercent
  let offset = 0
  for (const row of rows) {
    const first = row.lower * columnsCount
    const second = first + columnsCount
    for (const column of columns) {
      const index = column.lower
      const nearest = values[(row.weight < .5 ? first : second) + index + (column.weight < .5 ? 0 : 1)]
      if (nearest !== null) {
        const a = values[first + index]
        const b = values[first + index + 1]
        const c = values[second + index]
        const d = values[second + index + 1]
        const strain = a !== null && b !== null && c !== null && d !== null
          ? blend(blend(a, b, column.weight), blend(c, d, column.weight), row.weight)
          : nearest
        const normalized = Math.max(0, Math.min(1, (strain - minimum) / (maximum - minimum)))
        const color = normalized * (palette.length - 1)
        const stop = Math.min(palette.length - 2, Math.floor(color))
        for (let i = 0; i < 3; i++) raster.data[offset + i] = blend(palette[stop][i], palette[stop + 1][i], color - stop)
        raster.data[offset + 3] = 255
      }
      offset += 4
    }
  }
  context.putImageData(raster, 0, 0)
  return canvas.toDataURL('image/png')
}

function PlotTicks({ frame, horizontal, vertical, xLabel, yLabel, height }: {
  frame: Frame
  horizontal: Domain
  vertical: Domain
  xLabel: string
  yLabel: string
  height: number
}) {
  const { left, right, top, bottom } = frame
  const x = (value: number) => scale(value, horizontal, left, right)
  const y = (value: number) => scale(value, vertical, bottom, top)
  return (
    <g className="scientific-axis" aria-hidden="true">
      {ticks(horizontal, Math.max(3, Math.min(6, Math.floor((right - left) / 47)))).map((value) => (
        <g key={value}>
          <line className="scientific-tick" x1={x(value)} x2={x(value)} y1={bottom} y2={bottom + 4} />
          <text x={x(value)} y={bottom + 17} textAnchor="middle">{format.format(value)}</text>
        </g>
      ))}
      {ticks(vertical, Math.max(2, Math.min(5, Math.floor((bottom - top) / 35)))).map((value) => (
        <g key={value}>
          <line className="scientific-tick" x1={left - 4} x2={left} y1={y(value)} y2={y(value)} />
          <text x={left - 8} y={y(value) + 4} textAnchor="end">{format.format(value)}</text>
        </g>
      ))}
      <text className="scientific-axis-label" x={(left + right) / 2} y={height - 5} textAnchor="middle">{xLabel}</text>
      <text className="scientific-axis-label" transform={`translate(${left - 35} ${(top + bottom) / 2}) rotate(-90)`}
        textAnchor="middle">{yLabel}</text>
    </g>
  )
}

function StrainMap({ data, frame, limits, probe, select, compact, label }: {
  data: FullFieldStrainData
  frame: StrainFieldFrame
  limits: NonNullable<ReturnType<typeof getDomains>>
  probe: Probe
  select: (probe: Probe) => void
  compact: boolean
  label: string
}) {
  const gradientId = useId()
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 430 : 750, compact ? 173 : 345)
  const [image, setImage] = useState<{ frame: StrainFieldFrame; href?: string }>()
  useEffect(() => {
    setImage({ frame, href: fieldImage(data, frame) })
  }, [data, frame])
  const availableWidth = Math.max(1, width - (width < 375 ? 106 : 124))
  const availableHeight = Math.max(1, height - 63)
  const aspect = (limits.x[1] - limits.x[0]) / (limits.y[1] - limits.y[0])
  const plotWidth = Math.min(availableWidth, availableHeight * aspect)
  const plotHeight = Math.min(availableHeight, availableWidth / aspect)
  const left = 46 + (availableWidth - plotWidth) / 2
  const right = left + plotWidth
  const bottom = height - 40
  const top = bottom - plotHeight
  const bounds = { left, right, top, bottom }
  const x = (value: number) => scale(value, limits.x, left, right)
  const y = (value: number) => scale(value, limits.y, bottom, top)
  const colorX = right + 14
  const colorWidth = 10
  const cx = x(data.xMm[probe[0]])
  const cy = y(data.yMm[probe[1]])
  const strain = frame.strainPercent[probe[1] * data.xMm.length + probe[0]]
  const [minimum, maximum] = data.strainDomainPercent
  const colorValues = plotHeight > 104 ? [minimum, blend(minimum, maximum, .5), maximum] : [minimum, maximum]

  function pick(event: MouseEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = scale(event.clientX, [rect.left, rect.right], ...limits.x)
    const y = scale(event.clientY, [rect.top, rect.bottom], limits.y[1], limits.y[0])
    select([closestIndex(data.xMm, x), closestIndex(data.yMm, y)])
  }

  function inspect(event: KeyboardEvent<SVGRectElement>) {
    const [column, row] = probe
    const movement: Partial<Record<string, Probe>> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }
    const step = movement[event.key]
    if (!step) return
    event.preventDefault()
    select([
      Math.max(0, Math.min(data.xMm.length - 1, column + step[0])),
      Math.max(0, Math.min(data.yMm.length - 1, row + step[1])),
    ])
  }

  return (
    <div className="strain-map scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} role={compact ? 'img' : 'group'} data-strain-map=""
        aria-label={`${label}. ${data.componentLabel} strain field, ${data.stageLabel.toLowerCase()} ${format.format(frame.stage)}.`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" x2="0%" y1="100%" y2="0%">
            {palette.map((color, index) => <stop key={index} offset={index / (palette.length - 1)}
              stopColor={`rgb(${color.join(' ')})`} />)}
          </linearGradient>
        </defs>
        <text className="scientific-axis scientific-panel-title" x={left} y={Math.max(14, top - 7)}>{data.componentLabel}</text>
        {image?.frame === frame && image.href && (
          <image data-strain-raster="" data-stage={frame.stage} href={image.href} x={left} y={top} width={plotWidth} height={plotHeight}
            preserveAspectRatio="none" aria-hidden="true" />
        )}
        <rect className="scientific-frame" data-strain-map-frame="" x={left} y={top} width={plotWidth} height={plotHeight} aria-hidden="true" />
        <PlotTicks frame={bounds} horizontal={limits.x} vertical={limits.y} xLabel="X (mm)" yLabel="Y (mm)" height={height} />
        <g className="scientific-axis" data-strain-colorbar="" data-min={minimum} data-max={maximum} aria-hidden="true">
          <rect x={colorX} y={top} width={colorWidth} height={plotHeight} fill={`url(#${gradientId})`} />
          <rect className="scientific-frame" x={colorX} y={top} width={colorWidth} height={plotHeight} />
          {colorValues.map((value) => {
            const y = scale(value, data.strainDomainPercent, bottom, top)
            return (
              <g key={value}>
                <line className="scientific-tick" x1={colorX + colorWidth} x2={colorX + colorWidth + 4} y1={y} y2={y} />
                <text x={colorX + colorWidth + 7} y={y + 4}>{format.format(value)}</text>
              </g>
            )
          })}
          <text className="scientific-axis-label" x={colorX} y={bottom + 17}>Strain (%)</text>
        </g>
        {!compact && (
          <>
            <g data-strain-probe="" data-valid={strain !== null} aria-hidden="true" className="strain-probe">
              <circle cx={cx} cy={cy} r={5} />
              <path d={`M${cx - 7} ${cy}h14 M${cx} ${cy - 7}v14`} />
            </g>
            <rect x={left} y={top} width={plotWidth} height={plotHeight} className="strain-map-pick"
              fill="transparent" role="button" tabIndex={0} aria-label="Inspect strain map"
              onClick={pick} onKeyDown={inspect} />
          </>
        )}
      </svg>
    </div>
  )
}

function ForcePlot({ limits, data, frame, select }: {
  limits: NonNullable<ReturnType<typeof getDomains>>
  data: FullFieldStrainData
  frame: StrainFieldFrame
  select: (stage: number) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(750, 165)
  const left = 54
  const right = Math.max(left + 1, width - 21)
  const top = 17
  const bottom = Math.max(top + 1, height - 41)
  const x = (value: number) => scale(value, limits.stage, left, right)
  const y = (value: number) => scale(value, limits.force, bottom, top)
  const path = useMemo(() => limits.forceSamples.map(({ stage, forceN }, index) =>
    `${index ? 'L' : 'M'}${scale(stage, limits.stage, left, right).toFixed(2)} ${scale(forceN, limits.force, bottom, top).toFixed(2)}`).join(' '),
  [limits, left, right, top, bottom])
  const stageLabel = data.stageUnit ? `${data.stageLabel} (${data.stageUnit})` : data.stageLabel
  const cursor = x(frame.stage)

  function pick(event: MouseEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    select(scale(event.clientX, [bounds.left, bounds.right], ...limits.stage))
  }

  return (
    <div className="strain-force scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" data-strain-force="" aria-label={`Measured tensile force by ${data.stageLabel.toLowerCase()}`}>
        <rect className="scientific-frame" x={left} y={top} width={right - left} height={bottom - top} aria-hidden="true" />
        <PlotTicks frame={{ left, right, top, bottom }} horizontal={limits.stage} vertical={limits.force}
          xLabel={stageLabel} yLabel="Force (N)" height={height} />
        <g aria-hidden="true">
          <path className="strain-force-line" d={path} />
          <line className="scientific-reference" x1={cursor} x2={cursor} y1={top} y2={bottom} />
          <circle className="strain-force-cursor" data-strain-force-cursor="" data-stage={frame.stage} data-force={frame.forceN}
            cx={cursor} cy={y(frame.forceN)} r={4} />
        </g>
        <rect className="strain-force-pick" x={left} y={top} width={right - left} height={bottom - top} fill="transparent" onClick={pick} />
      </svg>
    </div>
  )
}

function initialProbe(data: FullFieldStrainData, frame: StrainFieldFrame): Probe {
  const center = [(data.xMm.length - 1) / 2, (data.yMm.length - 1) / 2]
  let chosen: Probe = [Math.round(center[0]), Math.round(center[1])]
  let distance = Infinity
  const columns = data.xMm.length
  frame.strainPercent.forEach((value, index) => {
    if (value === null) return
    const x = index % columns
    const y = Math.floor(index / columns)
    const current = (x - center[0]) ** 2 + (y - center[1]) ** 2
    if (current < distance) {
      distance = current
      chosen = [x, y]
    }
  })
  return chosen
}

function StrainFigure({ data, limits, initialStage, label, compact = false, source }: FullFieldStrainProps & {
  limits: NonNullable<ReturnType<typeof getDomains>>
  label: string
}) {
  const [stage, setStage] = useState(() => initialStage !== undefined && Number.isFinite(initialStage) ? initialStage : limits.stages[0])
  const index = closestIndex(limits.stages, stage)
  const frame = data.frames[index]
  const [probe, setProbe] = useState<Probe>(() => initialProbe(data, frame))
  const column = Math.min(probe[0], data.xMm.length - 1)
  const row = Math.min(probe[1], data.yMm.length - 1)
  const value = frame.strainPercent[row * data.xMm.length + column]
  const stageText = data.stageUnit ? `${format.format(frame.stage)} ${data.stageUnit}` : format.format(frame.stage)

  return (
    <figure className="full-field-strain" data-full-field-strain="" data-compact={compact}>
      <div className="strain-panels">
        <StrainMap data={data} frame={frame} limits={limits} probe={[column, row]} select={setProbe} compact={compact} label={label} />
        {!compact && <ForcePlot data={data} limits={limits} frame={frame} select={setStage} />}
      </div>
      {!compact && (
        <>
          <label className="strain-scrub">Frame
            <input type="range" min={0} max={data.frames.length - 1} step={1} value={index} aria-valuetext={stageText}
              onChange={(event) => setStage(data.frames[Number(event.currentTarget.value)].stage)} />
          </label>
          <output className="strain-readout" data-strain-readout="" data-stage={frame.stage} data-force={frame.forceN}
            data-x-mm={data.xMm[column]} data-y-mm={data.yMm[row]} data-strain={value ?? undefined}>
            <span>{data.stageLabel} <strong>{stageText}</strong></span>
            <span>Force <strong>{format.format(frame.forceN)} N</strong></span>
            <span>Probe <strong>{format.format(data.xMm[column])}, {format.format(data.yMm[row])} mm</strong></span>
            <span>Strain at probe <strong>{value === null ? 'No measurement' : `${format.format(value)}%`}</strong></span>
          </output>
          {source && (
            <figcaption className="strain-caption">
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

export function FullFieldStrain({ data, label = 'Full-field strain', ...props }: FullFieldStrainProps) {
  const limits = useMemo(() => getDomains(data), [data])
  if (!limits) return <p className="chart-render-message" role="status">Provide ordered field coordinates, aligned frames, and a valid strain color scale.</p>
  return <StrainFigure {...props} data={data} limits={limits} label={label} />
}
