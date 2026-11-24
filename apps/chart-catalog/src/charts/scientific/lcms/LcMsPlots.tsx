import type { MouseEvent } from 'react'
import { usePlotSize } from '../../usePlotSize'
import { nearestLcMsSampleIndex } from './model'
import type { LcMsPoint, PreparedLcMsFeature, PreparedLcMsTrace } from './model'

type Range = readonly [number, number]
type Viewport = { rt: Range; mz: Range }
type Plot = ReturnType<typeof plotFrame>

const overviewFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const detailFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 7 })
const intensityFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const intensityColors = [0, 1, 2, 3].map((level) => `var(--lcms-level-${level})`)

function padded(minimum: number, maximum: number, fallback: number): Range {
  const pad = (maximum - minimum) * .075 || fallback
  return [minimum - pad, maximum + pad]
}

function plotFrame(width: number, height: number, x: Range, y: Range, compact: boolean) {
  const left = compact ? 8 : 61
  const top = 12
  const right = Math.max(left + 1, width - 14)
  const bottom = Math.max(top + 1, height - (compact ? 9 : 44))
  return {
    left, top, right, bottom, width, height,
    x: (value: number) => left + (value - x[0]) / (x[1] - x[0]) * (right - left),
    time: (pixel: number) => x[0] + (pixel - left) / (right - left) * (x[1] - x[0]),
    y: (value: number) => bottom - (value - y[0]) / (y[1] - y[0]) * (bottom - top),
  }
}

function ticks([min, max]: Range, count: number) {
  const step0 = (max - min) / count
  const unit = 10 ** Math.floor(Math.log10(step0))
  const step = unit * ([1, 2, 2.5, 5, 10].find((value) => unit * value >= step0) ?? 10)
  const first = Math.ceil(min / step)
  const length = Math.max(0, Math.min(12, Math.floor(max / step) - first + 1))
  return Array.from({ length }, (_, index) => Number(((first + index) * step).toPrecision(13)))
}

function PlotAxes({ frame, x, y, xLabel, yLabel, formatX, formatY, compact, xUnit = 1 }: {
  frame: Plot; x: Range; y: Range; xLabel: string; yLabel: string
  formatX: (value: number) => string; formatY: (value: number) => string; compact: boolean; xUnit?: number
}) {
  const { left, top, right, bottom, width, height } = frame
  return <g className="scientific-axis lcms-axes" aria-hidden="true">
    <path d={`M${left} ${top}V${bottom}H${right}`} className="scientific-tick" fill="none" />
    {!compact && <>
      {ticks([x[0] / xUnit, x[1] / xUnit], width < 390 ? 4 : 7).map((value) => <g key={value}>
        <line x1={frame.x(value * xUnit)} x2={frame.x(value * xUnit)} y1={bottom} y2={bottom + 4} className="scientific-tick" />
        <text x={frame.x(value * xUnit)} y={bottom + 17} textAnchor="middle">{formatX(value)}</text>
      </g>)}
      {ticks(y, height < 235 ? 3 : 6).map((value) => <g key={value}>
        <line x1={left} x2={right} y1={frame.y(value)} y2={frame.y(value)} className="lcms-guide-line" />
        <line x1={left - 4} x2={left} y1={frame.y(value)} y2={frame.y(value)} className="scientific-tick" />
        <text x={left - 8} y={frame.y(value)} dominantBaseline="middle" textAnchor="end">{formatY(value)}</text>
      </g>)}
      <text className="scientific-axis-label" x={(left + right) / 2} y={height - 5} textAnchor="middle">{xLabel}</text>
      <text className="scientific-axis-label" transform={`translate(12 ${(top + bottom) / 2}) rotate(-90)`}
        textAnchor="middle">{yLabel}</text>
    </>}
  </g>
}

function footprintPath(hull: readonly LcMsPoint[], frame: Plot) {
  const path = hull.map(([rt, mz], index) => `${index ? 'L' : 'M'}${frame.x(rt)} ${frame.y(mz)}`).join('')
  return hull.length > 2 ? `${path}Z` : path
}

function Footprint({ trace, frame }: { trace: PreparedLcMsTrace; frame: Plot }) {
  if (!trace.hull.length) return null
  if (trace.hull.length === 1) {
    return <circle data-lcms-hull={trace.id} data-vertices={1}
      cx={frame.x(trace.hull[0][0])} cy={frame.y(trace.hull[0][1])} r={2} className="lcms-hull" />
  }
  return <path data-lcms-hull={trace.id} data-vertices={trace.hull.length} d={footprintPath(trace.hull, frame)} className="lcms-hull" />
}

export function featureViewport(feature: PreparedLcMsFeature): Viewport {
  let { minRt, maxRt, minMz, maxMz } = feature.bounds
  for (const trace of feature.traces) {
    const first = trace.samples?.[0]
    const last = trace.samples?.at(-1)
    if (first) minRt = Math.min(minRt, first[1])
    if (last) maxRt = Math.max(maxRt, last[1])
    minMz = Math.min(minMz, trace.mzWindow?.[0] ?? trace.mz)
    maxMz = Math.max(maxMz, trace.mzWindow?.[1] ?? trace.mz)
  }
  return { rt: padded(minRt, maxRt, .5), mz: padded(minMz, maxMz, .0025) }
}

function relativeIntensity(intensity: number, maximum: number) {
  if (intensity <= 0 || maximum <= 0) return intensityColors[0]
  const log = Math.log10(intensity / maximum)
  return intensityColors[Math.min(3, Math.max(0, Math.floor(log + 4)))]
}

export function FeatureOverview({ features, selected, onSelect, bounds, maximum }: {
  features: readonly PreparedLcMsFeature[]; selected: PreparedLcMsFeature
  bounds: PreparedLcMsFeature['bounds']; maximum: number
  onSelect: (id: string) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(760, 305)
  const rt = padded(bounds.minRt, bounds.maxRt, .5)
  const mz = padded(bounds.minMz, bounds.maxMz, .0025)
  const frame = plotFrame(width, height, rt, mz, false)
  const ordered = [...features.filter(({ id }) => id !== selected.id), selected]
  return <section className="lcms-overview" aria-label="Detected feature overview">
    <div className="lcms-panel-head">
      <h3>Detected features <span>{features.length}</span></h3>
      <div className="lcms-intensity-key" role="img" aria-label="Logarithmic color scale of feature intensity relative to the highest feature">
        <span>Relative intensity</span>
        <span className="lcms-intensity-ramp">
          {intensityColors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}
        </span>
        <span>10⁻⁴–1</span>
      </div>
    </div>
    <div className="scientific-plot lcms-overview-plot" ref={plot}>
      <svg data-lcms-overview viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Retention time by mass-to-charge ratio">
        <PlotAxes frame={frame} x={rt} y={mz} xLabel="Retention time (min)" yLabel="m/z"
          formatX={overviewFormat.format} formatY={overviewFormat.format} compact={false} xUnit={60} />
        {ordered.map((feature) => <g key={feature.id} data-lcms-feature={feature.id} data-active={feature.id === selected.id}
          style={{ color: relativeIntensity(feature.intensity, maximum) }} onClick={() => onSelect(feature.id)}>
          {feature.traces.map((trace) => <Footprint key={trace.id} trace={trace} frame={frame} />)}
          <circle className="lcms-feature-apex" cx={frame.x(feature.rtSeconds)} cy={frame.y(feature.mz)}
            r={feature.id === selected.id ? 4.5 : 2.6} />
          <circle data-lcms-feature-target className="lcms-feature-target" cx={frame.x(feature.rtSeconds)} cy={frame.y(feature.mz)} r={8} />
        </g>)}
      </svg>
    </div>
  </section>
}

export function FeatureFootprints({ feature, trace, viewport, scanTime, compact, onSelect, detail = false }: {
  feature: PreparedLcMsFeature; trace?: PreparedLcMsTrace; viewport: Viewport; scanTime?: number
  compact: boolean; onSelect: (id: string) => void; detail?: boolean
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(660, compact ? 115 : 204)
  const baseMz = trace?.mz ?? feature.mz
  const offset = (mz: number) => (mz - baseMz) / baseMz * 1_000_000
  const domainMz = detail
    ? padded(Math.min(baseMz, trace?.bounds?.minMz ?? baseMz, trace?.mzWindow?.[0] ?? baseMz),
        Math.max(baseMz, trace?.bounds?.maxMz ?? baseMz, trace?.mzWindow?.[1] ?? baseMz), baseMz * 5e-6)
    : viewport.mz
  const traces = detail ? (trace ? [trace] : []) : feature.traces
  const frame = plotFrame(width, height, viewport.rt, domainMz, compact)
  const axis = detail ? { ...frame, y: (ppm: number) => frame.y(baseMz * (1 + ppm * 1e-6)) } : frame
  const { left, right, top, bottom } = frame
  return <div className="scientific-plot lcms-footprints-plot" ref={plot}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={detail ? 'Selected mass trace in parts per million' : 'Selected feature mass-trace footprints'}
      data-lcms-footprints={detail ? undefined : ''} data-lcms-trace-detail={detail ? '' : undefined}
      data-reference-mz={detail ? baseMz : undefined}>
      <PlotAxes frame={axis} x={viewport.rt} y={detail ? [offset(domainMz[0]), offset(domainMz[1])] : domainMz}
        xLabel="Retention time (s)" yLabel={detail ? 'Mass offset (ppm)' : 'm/z'}
        formatX={detailFormat.format} formatY={detailFormat.format} compact={compact} />
      {trace?.mzWindow && <rect data-lcms-extraction-window className="lcms-extraction-window" x={left} width={right - left}
        y={frame.y(trace.mzWindow[1])} height={frame.y(trace.mzWindow[0]) - frame.y(trace.mzWindow[1])} />}
      {traces.map((item) => <g key={item.id} className="lcms-trace-footprint" data-lcms-trace={item.id}
        data-active={item.id === trace?.id} onClick={compact || detail ? undefined : () => onSelect(item.id)}>
        <Footprint trace={item} frame={frame} />
        {!compact && !detail && item.hull.length > 1 && <path className="lcms-shape-target" d={footprintPath(item.hull, frame)} />}
      </g>)}
      {!traces.some((item) => item.hull.length > 0) &&
        <circle className="lcms-centroid" cx={frame.x(feature.rtSeconds)} cy={frame.y(detail ? baseMz : feature.mz)} r={3} />}
      {scanTime !== undefined && <line data-lcms-footprint-scan className="lcms-scan-cursor"
        x1={frame.x(scanTime)} x2={frame.x(scanTime)} y1={top} y2={bottom} />}
    </svg>
  </div>
}

export function IonChromatogram({ trace, viewport, scanIndex, compact, onInspect }: {
  trace: PreparedLcMsTrace; viewport: Viewport; scanIndex: number; compact: boolean
  onInspect: (index: number) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(660, compact ? 83 : 200)
  const samples = trace.samples ?? []
  const maximum = samples.reduce((max, [, , value]) => value === null ? max : Math.max(max, value), 0)
  const intensity: Range = [0, maximum > 0 ? maximum * 1.12 : 1]
  const frame = plotFrame(width, height, viewport.rt, intensity, compact)
  const selected = samples[scanIndex]
  const path = samples.map(([, rt, value], index) => {
    if (value === null) return ''
    return `${index > 0 && samples[index - 1][2] !== null ? 'L' : 'M'}${frame.x(rt)} ${frame.y(value)}`
  }).join('')

  function inspect(event: MouseEvent<SVGRectElement>) {
    const matrix = event.currentTarget.ownerSVGElement?.getScreenCTM()
    if (!matrix || !samples.length) return
    const position = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    const time = frame.time(position.x)
    const nearest = nearestLcMsSampleIndex(samples, time)
    if (nearest !== undefined) onInspect(nearest)
  }

  return <div className="scientific-plot lcms-xic-plot" ref={plot}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Extracted-ion chromatogram" data-lcms-chromatogram>
      <PlotAxes frame={frame} x={viewport.rt} y={intensity} xLabel="Retention time (s)" yLabel="Ion intensity"
        formatX={detailFormat.format} formatY={intensityFormat.format} compact={compact} />
      <path data-lcms-ion-path className="lcms-ion-path" d={path} />
      {!compact && samples.map(([id, rt, value]) => value !== null
        ? <circle key={id} data-lcms-scan={id} data-rt={rt} data-intensity={value}
            className="lcms-measured-point" cx={frame.x(rt)} cy={frame.y(value)} r={1.45} />
        : <line key={id} data-lcms-scan={id} data-rt={rt} data-missing="true" className="lcms-gap"
            x1={frame.x(rt)} x2={frame.x(rt)} y1={frame.bottom - 5} y2={frame.bottom} />)}
      {!compact && selected && <g data-lcms-selected-scan={selected[0]}>
        <line className="lcms-scan-cursor" x1={frame.x(selected[1])} x2={frame.x(selected[1])} y1={frame.top} y2={frame.bottom} />
        {selected[2] !== null && <circle className="lcms-active-scan" cx={frame.x(selected[1])} cy={frame.y(selected[2])} r={4} />}
      </g>}
      {!compact && <rect data-lcms-chromatogram-target className="lcms-chromatogram-target"
        x={frame.left} y={frame.top} width={frame.right - frame.left} height={frame.bottom - frame.top} onClick={inspect} />}
    </svg>
  </div>
}
