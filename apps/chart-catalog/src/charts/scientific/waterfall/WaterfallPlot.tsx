import { useId, useMemo, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { usePlotSize } from '../../usePlotSize'
import { axisTitle, intensityExtent, readIntensity } from './model'
import type { SpectralSelection, SpectralWaterfallAxes, SpectralWaterfallData } from './model'
import './waterfall-plot.css'

interface WaterfallPlotProps {
  data: SpectralWaterfallData
  axes: SpectralWaterfallAxes
  selection: SpectralSelection
  onSelect: (selection: SpectralSelection) => void
  compact?: boolean
}

type Extent = readonly [number, number]
type Point = readonly [number, number]
type Camera = { azimuth: number; elevation: number }
type Project = (spectral: number, scan: number, intensity: number) => Point

const initialCamera = { azimuth: 30, elevation: 25 }
const labels = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4, useGrouping: false })

function tickLabel(value: number) {
  const absolute = Math.abs(value)
  return absolute >= 1e6 || (absolute > 0 && absolute < 1e-3)
    ? value.toExponential(2)
    : labels.format(value)
}

function axisExtent(values: ArrayLike<number>): Extent {
  return [values[0], values[values.length - 1]]
}

function normalize(value: number, [min, max]: Extent) {
  if (min === max) return 0.5
  const span = max - min
  return Number.isFinite(span) ? (value - min) / span : (value / 2 - min / 2) / (max / 2 - min / 2)
}

function projection(width: number, height: number, camera: Camera, compact: boolean): Project {
  const azimuth = camera.azimuth * Math.PI / 180
  const elevation = camera.elevation * Math.PI / 180
  const horizontalX = 1.58 * Math.cos(azimuth)
  const horizontalY = -0.96 * Math.sin(azimuth)
  const verticalX = 1.58 * Math.sin(azimuth) * Math.sin(elevation)
  const verticalY = 0.96 * Math.cos(azimuth) * Math.sin(elevation)
  const verticalZ = -0.74 * Math.cos(elevation)
  const xSpan = horizontalX - horizontalY
  const ySpan = verticalX + verticalY - verticalZ
  const marginX = compact ? 8 : Math.min(56, width * 0.19)
  const marginY = compact ? 6 : 25
  const scale = Math.max(1, Math.min((width - marginX * 2) / xSpan, (height - marginY * 2) / ySpan))
  const originX = (width - xSpan * scale) / 2 - horizontalY * scale
  const originY = (height - ySpan * scale) / 2 - verticalZ * scale
  return (x, y, z) => [
    originX + (x * horizontalX + y * horizontalY) * scale,
    originY + (x * verticalX + y * verticalY + z * verticalZ) * scale,
  ]
}

function sampledScans(scanCount: number, limit: number, selection: number | undefined) {
  const count = Math.min(scanCount, limit)
  const sampled = new Set(Array.from({ length: count }, (_, index) =>
    count <= 1 ? 0 : Math.round(index * (scanCount - 1) / (count - 1)),
  ))
  if (selection !== undefined && selection >= 0 && selection < scanCount) sampled.add(selection)
  return Array.from(sampled).sort((left, right) => left - right)
}

function ridgeBins(values: ArrayLike<number>, offset: number, length: number, bucketSize: number, selectedBin?: number) {
  const segments: number[][] = []
  let segment: number[] = []
  let samples: number[] = []

  function flush() {
    if (!samples.length) return
    let lowest = samples[0]
    let highest = samples[0]
    for (const bin of samples) {
      if (values[offset + bin] < values[offset + lowest]) lowest = bin
      if (values[offset + bin] > values[offset + highest]) highest = bin
    }
    const kept = new Set([samples[0], lowest, highest, samples[samples.length - 1]])
    if (selectedBin !== undefined && selectedBin >= samples[0] && selectedBin <= samples[samples.length - 1]) {
      kept.add(selectedBin)
    }
    segment.push(...Array.from(kept).sort((left, right) => left - right))
    samples = []
  }

  for (let bin = 0; bin < length; bin += 1) {
    if (!Number.isFinite(values[offset + bin])) {
      flush()
      if (segment.length) segments.push(segment)
      segment = []
      continue
    }
    if (bucketSize === 1) {
      segment.push(bin)
      continue
    }
    samples.push(bin)
    if (samples.length === bucketSize) flush()
  }
  flush()
  if (segment.length) segments.push(segment)
  return segments
}

function pointText([x, y]: Point) {
  return `${x.toFixed(2)} ${y.toFixed(2)}`
}

function scene(
  data: SpectralWaterfallData,
  project: Project,
  intensity: Extent,
  selection: SpectralSelection,
  compact: boolean,
  width: number,
) {
  const spectral = axisExtent(data.spectralBins)
  const scan = axisExtent(data.scanValues)
  const widthInBins = data.spectralBins.length
  const scanIndexes = sampledScans(data.scanValues.length, compact ? 18 : 72, compact ? undefined : selection.scanIndex)
  const bucketSize = Math.max(1, Math.ceil(widthInBins / Math.max(32, Math.floor(width / 2))))
  return scanIndexes.map((scanIndex) => {
    const selected = !compact && selection.scanIndex === scanIndex
    const depth = normalize(data.scanValues[scanIndex], scan)
    const offset = scanIndex * widthInBins
    const segments = ridgeBins(data.values, offset, widthInBins, bucketSize, selected ? selection.binIndex : undefined)
    const lines = segments.map((bins) => {
      const samples = bins.map((binIndex) => {
        const spectralPosition = normalize(data.spectralBins[binIndex], spectral)
        return {
          binIndex,
          spectralPosition,
          point: project(spectralPosition, depth, normalize(data.values[offset + binIndex], intensity)),
        }
      })
      const line = `M ${samples.map(({ point }) => pointText(point)).join(' L ')}`
      const first = samples[0].spectralPosition
      const last = samples[samples.length - 1].spectralPosition
      const fill = `${line} L ${pointText(project(last, depth, 0))} L ${pointText(project(first, depth, 0))} Z`
      return { line, fill, samples }
    })
    return { scanIndex, selected, lines }
  })
}

function valuesAtTicks([min, max]: Extent, ticks: readonly number[]) {
  if (min === max) return [{ ratio: 0.5, label: tickLabel(min) }]
  return ticks.map((ratio) => ({ ratio, label: tickLabel(min * (1 - ratio) + max * ratio) }))
}

const guidePositions = [0, 0.5, 1]

function PlotFrame({ project, compact }: { project: Project; compact: boolean }) {
  const floor = [project(0, 0, 0), project(1, 0, 0), project(1, 1, 0), project(0, 1, 0)]
  return (
    <g aria-hidden="true">
      <polygon className="spectral-waterfall-floor" points={floor.map(pointText).join(' ')} />
      {!compact && (
        <>
          <path className="spectral-waterfall-frame"
            d={`M ${pointText(floor[0])} L ${pointText(project(0, 0, 1))} L ${pointText(project(1, 0, 1))} L ${pointText(floor[1])}`} />
          {guidePositions.map((position) => (
            <path key={position} className="spectral-waterfall-grid"
              d={`M ${pointText(project(0, position, 0))} L ${pointText(project(1, position, 0))} M ${pointText(project(position, 0, 0))} L ${pointText(project(position, 1, 0))}`} />
          ))}
        </>
      )}
    </g>
  )
}

function PlotAxes({ data, project, intensity }: {
  data: SpectralWaterfallData
  project: Project
  intensity: Extent
}) {
  const [xLabelX, xLabelY] = project(1, 1, 0)
  const [yLabelX, yLabelY] = project(0, 1, 0)
  const [zLabelX, zLabelY] = project(1, 0, 1)
  return (
    <g aria-hidden="true" className="spectral-waterfall-ticks">
      <text className="spectral-waterfall-axis-letter" x={xLabelX + 9} y={xLabelY + 4}>X</text>
      <text className="spectral-waterfall-axis-letter" x={yLabelX - 9} y={yLabelY - 11} textAnchor="end">Y</text>
      <text className="spectral-waterfall-axis-letter" x={zLabelX + 7} y={zLabelY - 7}>Z</text>
      {valuesAtTicks(axisExtent(data.spectralBins), guidePositions).map(({ ratio, label }) => {
        const [x, y] = project(ratio, 1, 0)
        return <text key={ratio} x={x} y={y + 15} textAnchor="middle">{label}</text>
      })}
      {valuesAtTicks(axisExtent(data.scanValues), guidePositions).map(({ ratio, label }) => {
        const [x, y] = project(0, ratio, 0)
        return <text key={ratio} x={x - 6} y={y + 2} textAnchor="end">{label}</text>
      })}
      {valuesAtTicks(intensity, guidePositions).map(({ ratio, label }) => {
        const [x, y] = project(1, 0, ratio)
        return <text key={ratio} x={x + 6} y={y + 7}>{label}</text>
      })}
    </g>
  )
}

export function WaterfallPlot({ data, axes, selection, onSelect, compact = false }: WaterfallPlotProps) {
  const [camera, setCamera] = useState(initialCamera)
  const instructions = useId()
  const { plot, width, height } = usePlotSize<SVGSVGElement>(compact ? 320 : 640, compact ? 140 : 360)
  const intensity = useMemo(() => intensityExtent(data.values), [data.values])
  const project = useMemo(() => projection(width, height, camera, compact), [width, height, camera, compact])
  const ridges = useMemo(
    () => intensity ? scene(data, project, intensity, selection, compact, width) : [],
    [data, project, intensity, selection, compact, width],
  )
  const activeRidge = ridges.find((ridge) => ridge.selected)
  const activePoint = activeRidge?.lines.flatMap(({ samples }) => samples).find(({ binIndex }) => binIndex === selection.binIndex)
  const missing = !Number.isFinite(readIntensity(data, selection))

  function pickPoint(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) * width / rect.width
    const y = (event.clientY - rect.top) * height / rect.height
    let distance = (event.pointerType === 'touch' ? 26 : 16) ** 2
    let nearest: SpectralSelection | undefined
    for (const { scanIndex, lines } of ridges) {
      for (const { samples } of lines) {
        for (const { binIndex, point } of samples) {
          const squared = (point[0] - x) ** 2 + (point[1] - y) ** 2
          if (squared <= distance) {
            distance = squared
            nearest = { scanIndex, binIndex }
          }
        }
      }
    }
    if (nearest) onSelect(nearest)
  }

  function pickWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const binChange = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    const scanChange = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
    if (binChange === 0 && scanChange === 0) return
    event.preventDefault()
    onSelect({
      scanIndex: Math.max(0, Math.min(data.scanValues.length - 1, selection.scanIndex + scanChange)),
      binIndex: Math.max(0, Math.min(data.spectralBins.length - 1, selection.binIndex + binChange)),
    })
  }

  return (
    <div className="spectral-waterfall-plot" data-waterfall-plot="" data-compact={compact}>
      <div className="spectral-waterfall-viewport"
        role={compact ? undefined : 'group'}
        aria-label={compact ? undefined : 'Spectral waterfall'}
        aria-describedby={compact ? undefined : instructions}
        tabIndex={compact ? undefined : 0}
        onKeyDown={compact ? undefined : pickWithKeyboard}>
        <svg ref={plot} viewBox={`0 0 ${width} ${height}`} aria-hidden="true"
          onPointerUp={compact ? undefined : pickPoint}>
          {intensity && (
            <>
              <PlotFrame project={project} compact={compact} />
              {ridges.map(({ scanIndex, selected, lines }) => (
                <g key={scanIndex} className="spectral-waterfall-ridge"
                  data-waterfall-ridge={scanIndex} data-selected={selected}>
                  {lines.map(({ line, fill, samples }) => (
                    <g key={samples[0].binIndex}>
                      {samples.length > 1 ? (
                        <>
                          <path d={fill} className="spectral-waterfall-fill" />
                          <path d={line} className="spectral-waterfall-trace" />
                        </>
                      ) : <circle cx={samples[0].point[0]} cy={samples[0].point[1]} r={1.6}
                        className="spectral-waterfall-single" />}
                    </g>
                  ))}
                </g>
              ))}
              {!compact && <PlotAxes data={data} project={project} intensity={intensity} />}
              {!missing && activePoint && <circle className="spectral-waterfall-point"
                data-waterfall-selected-bin={selection.binIndex} data-waterfall-selected-scan={selection.scanIndex}
                cx={activePoint.point[0]} cy={activePoint.point[1]} r={4} />}
            </>
          )}
        </svg>
        {!intensity && !compact && <p className="spectral-waterfall-empty">No measured intensities</p>}
      </div>
      {!compact && (
        <>
          <p className="spectral-waterfall-instructions" id={instructions}>
            Use left and right arrows for spectral bins. Use up and down arrows for scans.
          </p>
          <dl className="spectral-waterfall-axes">
            <div><dt>X</dt><dd>{axisTitle(axes.spectral)}</dd></div>
            <div><dt>Y</dt><dd>{axisTitle(axes.scan)}</dd></div>
            <div><dt>Z</dt><dd>{axisTitle(axes.intensity)}</dd></div>
          </dl>
          <div className="spectral-waterfall-camera">
            <label className="spectral-waterfall-angle">
              <span>Azimuth</span>
              <input type="range" min={12} max={66} value={camera.azimuth}
                aria-valuetext={`${camera.azimuth} degrees`}
                onChange={(event) => setCamera({ ...camera, azimuth: event.currentTarget.valueAsNumber })} />
            </label>
            <label className="spectral-waterfall-angle">
              <span>Elevation</span>
              <input type="range" min={14} max={62} value={camera.elevation}
                aria-valuetext={`${camera.elevation} degrees`}
                onChange={(event) => setCamera({ ...camera, elevation: event.currentTarget.valueAsNumber })} />
            </label>
            <button type="button" className="spectral-waterfall-reset" onClick={() => setCamera(initialCamera)}>
              Reset view
            </button>
          </div>
        </>
      )}
    </div>
  )
}
