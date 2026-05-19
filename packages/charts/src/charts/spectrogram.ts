import { RenderCommandList, ZLayer } from '../renderer/render-command-list.js'
import type { RectOptions, RenderContext } from '../renderer/types.js'
import type { ViewTransform } from '../renderer/view-transform.js'
import {
  addChartGuidesToCommandList,
  type ChartGuideOptions,
  type ChartLayout,
  type ChartLayoutOptions,
  createPlotViewportTransform,
  createViewportTransform,
  drawCommandList,
  expandRange,
  isFiniteNumber,
  type NumericRange,
  normalizeRange,
  type RgbaColor,
  resolveChartLayout,
} from './common.js'

export type SpectrogramValueLayout = 'frequency-major' | 'time-major'

export interface SpectrogramColorStop {
  value: number
  color: RgbaColor
}

export interface SpectrogramDataSet {
  timeBins: Float64Array
  frequencyBins: Float64Array
  values: Float32Array | Float64Array
  valueLayout?: SpectrogramValueLayout
  timeBinWidth?: number
  frequencyBinWidth?: number
  colorStops?: readonly SpectrogramColorStop[]
  missingColor?: RgbaColor
}

export interface SpectrogramRenderOptions {
  xRange?: NumericRange
  yRange?: NumericRange
  zRange?: NumericRange
  defaultColorStops?: readonly SpectrogramColorStop[]
  missingColor?: RgbaColor
  includeMissing?: boolean
}

export interface SpectrogramPlannedTile {
  x: number
  y: number
  width: number
  height: number
  value: number
  style: RectOptions
}

export interface SpectrogramRenderPlan {
  kind: 'spectrogram'
  xRange: NumericRange
  xOrigin: number
  xRelativeRange: NumericRange
  yRange: NumericRange
  zRange: NumericRange
  timeBinCount: number
  frequencyBinCount: number
  sourceTileCount: number
  includedTileCount: number
  renderedTileCount: number
  tiles: readonly SpectrogramPlannedTile[]
  warnings: readonly string[]
}

export interface SpectrogramFrameOptions {
  layout?: ChartLayout | ChartLayoutOptions
  guides?: ChartGuideOptions | false
}

export interface SpectrogramCommandFrame {
  width: number
  height: number
  layout: ChartLayout | null
  commands: RenderCommandList
  transform: ViewTransform
}

const DEFAULT_COLOR_STOPS: readonly SpectrogramColorStop[] = [
  { value: 0, color: [0.04, 0.07, 0.16, 1] },
  { value: 0.35, color: [0.03, 0.58, 0.78, 1] },
  { value: 0.7, color: [0.93, 0.74, 0.22, 1] },
  { value: 1, color: [0.86, 0.15, 0.15, 1] },
]
const DEFAULT_MISSING_COLOR: RgbaColor = [0.15, 0.15, 0.15, 0.12]

export function buildSpectrogramRenderPlan(
  data: SpectrogramDataSet,
  options: SpectrogramRenderOptions = {},
): SpectrogramRenderPlan {
  const timeBinCount = data.timeBins.length
  const frequencyBinCount = data.frequencyBins.length
  const sourceTileCount = timeBinCount * frequencyBinCount
  const warnings: string[] = []

  if (data.values.length < sourceTileCount) {
    warnings.push(
      `Spectrogram values provide ${data.values.length} tiles for ${sourceTileCount} time-frequency bins.`,
    )
  }

  const timeExtents = buildBinExtents(data.timeBins, data.timeBinWidth)
  const frequencyExtents = buildBinExtents(data.frequencyBins, data.frequencyBinWidth)
  const xRange = options.xRange
    ? normalizeRange(options.xRange)
    : inferBinRange(data.timeBins, timeExtents.widths)
  const yRange = options.yRange
    ? normalizeRange(options.yRange)
    : inferBinRange(data.frequencyBins, frequencyExtents.widths)
  const zRange = options.zRange
    ? normalizeRange(options.zRange)
    : inferSpectrogramZRange(data, timeExtents, frequencyExtents, xRange, yRange)
  const colorStops = normalizeColorStops(
    data.colorStops ?? options.defaultColorStops ?? DEFAULT_COLOR_STOPS,
  )
  const missingColor = data.missingColor ?? options.missingColor ?? DEFAULT_MISSING_COLOR
  const includeMissing = options.includeMissing === true
  const maxTileCount = Math.min(sourceTileCount, data.values.length)
  const tiles = new Array<SpectrogramPlannedTile>(includeMissing ? sourceTileCount : maxTileCount)
  const layout = data.valueLayout ?? 'frequency-major'
  let includedTileCount = 0
  let renderedTileCount = 0

  for (let frequencyIndex = 0; frequencyIndex < frequencyBinCount; frequencyIndex++) {
    const frequency = data.frequencyBins[frequencyIndex]
    const frequencyWidth = frequencyExtents.widths[frequencyIndex]
    if (!isFiniteNumber(frequency) || !isFiniteNumber(frequencyWidth)) continue
    const y = frequency - frequencyWidth / 2
    const yEnd = frequency + frequencyWidth / 2
    if (yEnd < yRange[0] || y > yRange[1]) continue

    for (let timeIndex = 0; timeIndex < timeBinCount; timeIndex++) {
      const time = data.timeBins[timeIndex]
      const timeWidth = timeExtents.widths[timeIndex]
      if (!isFiniteNumber(time) || !isFiniteNumber(timeWidth)) continue
      const x = time - timeWidth / 2
      const xEnd = time + timeWidth / 2
      if (xEnd < xRange[0] || x > xRange[1]) continue

      const valueIndex = spectrogramValueIndex(layout, timeIndex, frequencyIndex, {
        timeBinCount,
        frequencyBinCount,
      })
      const rawValue = data.values[valueIndex]
      const finiteValue = isFiniteNumber(rawValue) ? rawValue : undefined
      if (finiteValue === undefined && !includeMissing) continue

      const clippedX = Math.max(x, xRange[0])
      const clippedY = Math.max(y, yRange[0])
      const clippedEndX = Math.min(xEnd, xRange[1])
      const clippedEndY = Math.min(yEnd, yRange[1])
      if (clippedEndX <= clippedX || clippedEndY <= clippedY) continue

      includedTileCount += 1
      const value = finiteValue ?? Number.NaN
      tiles[renderedTileCount] = {
        x: clippedX,
        y: clippedY,
        width: clippedEndX - clippedX,
        height: clippedEndY - clippedY,
        value,
        style: {
          fillColor:
            finiteValue === undefined
              ? missingColor
              : colorForValue(finiteValue, zRange, colorStops),
        },
      }
      renderedTileCount += 1
    }
  }

  tiles.length = renderedTileCount

  return {
    kind: 'spectrogram',
    xRange,
    xOrigin: 0,
    xRelativeRange: xRange,
    yRange,
    zRange,
    timeBinCount,
    frequencyBinCount,
    sourceTileCount,
    includedTileCount,
    renderedTileCount,
    tiles,
    warnings,
  }
}

export function addSpectrogramToCommandList(
  commands: RenderCommandList,
  plan: SpectrogramRenderPlan,
  z: ZLayer = ZLayer.Fill,
): void {
  for (const tile of plan.tiles) {
    commands.addRect(tile.x, tile.y, tile.width, tile.height, tile.style, z)
  }
}

export function createSpectrogramViewTransform(
  plan: SpectrogramRenderPlan,
  width: number,
  height: number,
): ViewTransform {
  return createViewportTransform(plan.xRelativeRange, plan.yRange, width, height)
}

export function buildSpectrogramCommandFrame(
  plan: SpectrogramRenderPlan,
  width: number,
  height: number,
  options: SpectrogramFrameOptions = {},
): SpectrogramCommandFrame {
  const layout = resolveChartLayout(options.layout, width, height, plan.xRelativeRange, plan.yRange)
  const transform = layout
    ? createPlotViewportTransform(plan.xRelativeRange, plan.yRange, width, height, layout.plotArea)
    : createSpectrogramViewTransform(plan, width, height)
  const commands = new RenderCommandList()
  addSpectrogramToCommandList(commands, plan)
  if (layout && options.guides !== false) {
    addChartGuidesToCommandList(commands, layout, plan.xRelativeRange, plan.yRange, options.guides)
  }

  return {
    width,
    height,
    layout,
    commands,
    transform,
  }
}

export function renderSpectrogramPlan(
  context: RenderContext,
  plan: SpectrogramRenderPlan,
  options: SpectrogramFrameOptions = {},
): void {
  const frame = buildSpectrogramCommandFrame(plan, context.width, context.height, options)
  context.setTransform(frame.transform)
  context.beginFrame()
  drawCommandList(context, frame.commands)
  context.endFrame()
}

function buildBinExtents(
  centers: Float64Array,
  explicitWidth: number | undefined,
): { widths: Float64Array } {
  const widths = new Float64Array(centers.length)
  const fallbackWidth = inferFallbackBinWidth(centers, explicitWidth)
  for (let index = 0; index < centers.length; index++) {
    widths[index] =
      explicitWidth !== undefined && explicitWidth > 0
        ? explicitWidth
        : inferBinWidth(centers, index, fallbackWidth)
  }
  return { widths }
}

function inferSpectrogramZRange(
  data: SpectrogramDataSet,
  timeExtents: { widths: Float64Array },
  frequencyExtents: { widths: Float64Array },
  xRange: NumericRange,
  yRange: NumericRange,
): NumericRange {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  const layout = data.valueLayout ?? 'frequency-major'
  const timeBinCount = data.timeBins.length
  const frequencyBinCount = data.frequencyBins.length

  for (let frequencyIndex = 0; frequencyIndex < frequencyBinCount; frequencyIndex++) {
    const frequency = data.frequencyBins[frequencyIndex]
    const frequencyWidth = frequencyExtents.widths[frequencyIndex]
    if (!isFiniteNumber(frequency) || !isFiniteNumber(frequencyWidth)) continue
    if (frequency + frequencyWidth / 2 < yRange[0] || frequency - frequencyWidth / 2 > yRange[1]) {
      continue
    }

    for (let timeIndex = 0; timeIndex < timeBinCount; timeIndex++) {
      const time = data.timeBins[timeIndex]
      const timeWidth = timeExtents.widths[timeIndex]
      if (!isFiniteNumber(time) || !isFiniteNumber(timeWidth)) continue
      if (time + timeWidth / 2 < xRange[0] || time - timeWidth / 2 > xRange[1]) continue
      const value =
        data.values[
          spectrogramValueIndex(layout, timeIndex, frequencyIndex, {
            timeBinCount,
            frequencyBinCount,
          })
        ]
      if (!isFiniteNumber(value)) continue
      if (value < min) min = value
      if (value > max) max = value
    }
  }

  if (min === Number.POSITIVE_INFINITY) return [0, 1]
  return expandRange([min, max], 0.001)
}

function inferBinRange(centers: Float64Array, widths: Float64Array): NumericRange {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (let index = 0; index < centers.length; index++) {
    const center = centers[index]
    const width = widths[index]
    if (!isFiniteNumber(center) || !isFiniteNumber(width)) continue
    const start = center - width / 2
    const end = center + width / 2
    if (start < min) min = start
    if (end > max) max = end
  }

  if (min === Number.POSITIVE_INFINITY) return [0, 1]
  return normalizeRange([min, max])
}

function inferFallbackBinWidth(centers: Float64Array, explicitWidth: number | undefined): number {
  if (explicitWidth !== undefined && explicitWidth > 0) return explicitWidth
  for (let index = 1; index < centers.length; index++) {
    const previous = centers[index - 1]
    const current = centers[index]
    if (!isFiniteNumber(previous) || !isFiniteNumber(current)) continue
    const width = current - previous
    if (width > 0) return width
  }
  return 1
}

function inferBinWidth(centers: Float64Array, index: number, fallbackWidth: number): number {
  const current = centers[index]
  if (!isFiniteNumber(current)) return fallbackWidth
  const previous = centers[index - 1]
  const next = centers[index + 1]
  const previousGap = isFiniteNumber(previous) ? current - previous : Number.POSITIVE_INFINITY
  const nextGap = isFiniteNumber(next) ? next - current : Number.POSITIVE_INFINITY
  const width = Math.min(
    previousGap > 0 ? previousGap : Number.POSITIVE_INFINITY,
    nextGap > 0 ? nextGap : Number.POSITIVE_INFINITY,
  )
  return Number.isFinite(width) ? width : fallbackWidth
}

function spectrogramValueIndex(
  layout: SpectrogramValueLayout,
  timeIndex: number,
  frequencyIndex: number,
  dimensions: { timeBinCount: number; frequencyBinCount: number },
): number {
  return layout === 'time-major'
    ? timeIndex * dimensions.frequencyBinCount + frequencyIndex
    : frequencyIndex * dimensions.timeBinCount + timeIndex
}

function normalizeColorStops(
  stops: readonly SpectrogramColorStop[],
): readonly SpectrogramColorStop[] {
  if (stops.length === 0) return DEFAULT_COLOR_STOPS
  return [...stops].filter((stop) => isFiniteNumber(stop.value)).sort((a, b) => a.value - b.value)
}

function colorForValue(
  value: number,
  zRange: NumericRange,
  stops: readonly SpectrogramColorStop[],
): RgbaColor {
  const span = Math.max(Number.EPSILON, zRange[1] - zRange[0])
  const ratio = clamp((value - zRange[0]) / span, 0, 1)
  const fallbackLower = DEFAULT_COLOR_STOPS[0]
  const fallbackUpper = DEFAULT_COLOR_STOPS[DEFAULT_COLOR_STOPS.length - 1]
  if (!fallbackLower || !fallbackUpper) {
    return [0, 0, 0, 1]
  }
  let lower: SpectrogramColorStop = stops[0] ?? fallbackLower
  let upper: SpectrogramColorStop = stops[stops.length - 1] ?? fallbackUpper

  for (let index = 1; index < stops.length; index++) {
    const candidate = stops[index]
    if (!candidate) continue
    if (ratio <= candidate.value) {
      upper = candidate
      lower = stops[index - 1] ?? candidate
      break
    }
  }

  const stopSpan = Math.max(Number.EPSILON, upper.value - lower.value)
  const mix = clamp((ratio - lower.value) / stopSpan, 0, 1)
  return [
    lower.color[0] + (upper.color[0] - lower.color[0]) * mix,
    lower.color[1] + (upper.color[1] - lower.color[1]) * mix,
    lower.color[2] + (upper.color[2] - lower.color[2]) * mix,
    lower.color[3] + (upper.color[3] - lower.color[3]) * mix,
  ]
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}
