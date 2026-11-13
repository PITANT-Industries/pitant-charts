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
  getDefaultColor,
  isFiniteNumber,
  type NumericRange,
  normalizeRange,
  type RgbaColor,
  resolveChartLayout,
} from './common.js'

export type ScatterPlotMode = 'points' | 'density'
export type ScatterVector = Float32Array | Float64Array

export interface ScatterPlotSeries {
  key: string
  label: string
  x: ScatterVector
  y: ScatterVector
  color?: RgbaColor
  pointSize?: number
  visible?: boolean
}

export interface ScatterPlotDataSet {
  series: readonly ScatterPlotSeries[]
}

export interface ScatterPlotDensityOptions {
  enabled?: boolean
  columns?: number
  rows?: number
  minPointCount?: number
  minAlpha?: number
  maxAlpha?: number
}

export interface ScatterPlotRenderOptions {
  xRange?: NumericRange
  yRange?: NumericRange
  xPaddingRatio?: number
  yPaddingRatio?: number
  maxRenderedPoints?: number
  includeHidden?: boolean
  pointSize?: number
  density?: ScatterPlotDensityOptions
}

export interface ScatterPlannedPoint {
  seriesKey: string
  sourceIndex: number
  x: number
  y: number
  width: number
  height: number
  style: RectOptions
}

export interface ScatterDensityCell {
  seriesKey: string
  column: number
  row: number
  count: number
  x: number
  y: number
  width: number
  height: number
  style: RectOptions
}

export interface ScatterPlannedSeries {
  key: string
  label: string
  sourcePointCount: number
  filteredPointCount: number
  renderedPointCount: number
  densityCellCount: number
  mode: ScatterPlotMode
  color: RgbaColor
  points: readonly ScatterPlannedPoint[]
  densityCells: readonly ScatterDensityCell[]
}

export interface ScatterPlotRenderPlan {
  kind: 'scatter-plot'
  mode: ScatterPlotMode
  xRange: NumericRange
  xOrigin: number
  xRelativeRange: NumericRange
  yRange: NumericRange
  densityColumns: number
  densityRows: number
  sourcePointCount: number
  filteredPointCount: number
  renderedPointCount: number
  densityCellCount: number
  commandCount: number
  series: readonly ScatterPlannedSeries[]
  warnings: readonly string[]
}

export interface ScatterPlotFrameOptions {
  layout?: ChartLayout | ChartLayoutOptions
  guides?: ChartGuideOptions | false
}

export interface ScatterPlotCommandFrame {
  width: number
  height: number
  layout: ChartLayout | null
  commands: RenderCommandList
  transform: ViewTransform
}

const DEFAULT_MAX_RENDERED_POINTS = 20_000
const DEFAULT_DENSITY_COLUMNS = 192
const DEFAULT_DENSITY_ROWS = 128
const DEFAULT_POINT_SIZE = 2
const DEFAULT_DENSITY_MIN_ALPHA = 0.12
const DEFAULT_DENSITY_MAX_ALPHA = 0.88

export function buildScatterPlotRenderPlan(
  data: ScatterPlotDataSet,
  options: ScatterPlotRenderOptions = {},
): ScatterPlotRenderPlan {
  const warnings: string[] = []
  const visibleSeries = data.series.filter(
    (series) => series.visible !== false || options.includeHidden === true,
  )
  const xRange = options.xRange
    ? normalizeRange(options.xRange)
    : inferScatterRange(visibleSeries, 'x', options.xPaddingRatio ?? 0.04)
  const yRange = options.yRange
    ? normalizeRange(options.yRange)
    : inferScatterRange(visibleSeries, 'y', options.yPaddingRatio ?? 0.04)
  const xOrigin = xRange[0]
  const xRelativeRange: NumericRange = [0, xRange[1] - xOrigin]
  const maxRenderedPoints = Math.max(
    1,
    Math.floor(options.maxRenderedPoints ?? DEFAULT_MAX_RENDERED_POINTS),
  )
  const densityColumns = Math.max(
    1,
    Math.floor(options.density?.columns ?? DEFAULT_DENSITY_COLUMNS),
  )
  const densityRows = Math.max(1, Math.floor(options.density?.rows ?? DEFAULT_DENSITY_ROWS))
  const densityMinPointCount = Math.max(
    1,
    Math.floor(options.density?.minPointCount ?? maxRenderedPoints),
  )
  // Mode selection only needs to reach the density threshold. Density binning
  // counts every accepted point below, so a full preliminary scan is redundant.
  const modePointLimit =
    options.density?.enabled === false
      ? Number.POSITIVE_INFINITY
      : options.density?.enabled === true
        ? densityMinPointCount
        : maxRenderedPoints + 1
  let filteredPointCount = countFilteredScatterPoints(visibleSeries, xRange, yRange, modePointLimit)
  const mode = resolveScatterMode({
    densityEnabled: options.density?.enabled,
    filteredPointCount,
    maxRenderedPoints,
    minPointCount: densityMinPointCount,
  })
  const seriesPlans: ScatterPlannedSeries[] = []
  if (mode === 'density') filteredPointCount = 0
  let sourcePointCount = 0
  let renderedPointCount = 0
  let densityCellCount = 0

  for (let seriesIndex = 0; seriesIndex < visibleSeries.length; seriesIndex++) {
    const source = visibleSeries[seriesIndex] as ScatterPlotSeries
    const sourceCount = Math.min(source.x.length, source.y.length)
    if (source.x.length !== source.y.length) {
      warnings.push(
        `Scatter series "${source.key}" uses ${sourceCount} points because x and y lengths differ.`,
      )
    }

    sourcePointCount += sourceCount
    const color = source.color ?? getDefaultColor(seriesIndex)
    const planned =
      mode === 'density'
        ? buildDensitySeries(source, {
            color,
            columns: densityColumns,
            rows: densityRows,
            sourceCount,
            xOrigin,
            xRange,
            yRange,
            minAlpha: clamp(options.density?.minAlpha ?? DEFAULT_DENSITY_MIN_ALPHA, 0, 1),
            maxAlpha: clamp(options.density?.maxAlpha ?? DEFAULT_DENSITY_MAX_ALPHA, 0, 1),
          })
        : buildPointSeries(source, {
            color,
            filteredPointCount: countFilteredSeriesPoints(source, sourceCount, xRange, yRange),
            maxRenderedPoints,
            pointSize: source.pointSize ?? options.pointSize ?? DEFAULT_POINT_SIZE,
            sourceCount,
            xOrigin,
            xRange,
            yRange,
          })

    renderedPointCount += planned.renderedPointCount
    densityCellCount += planned.densityCellCount
    if (mode === 'density') filteredPointCount += planned.filteredPointCount
    seriesPlans.push(planned)
  }

  if (mode === 'points' && filteredPointCount > maxRenderedPoints) {
    warnings.push(
      `Scatter point rendering sampled ${filteredPointCount} filtered points to stay under ${maxRenderedPoints} commands.`,
    )
  }

  return {
    kind: 'scatter-plot',
    mode,
    xRange,
    xOrigin,
    xRelativeRange,
    yRange,
    densityColumns,
    densityRows,
    sourcePointCount,
    filteredPointCount,
    renderedPointCount,
    densityCellCount,
    commandCount: mode === 'density' ? densityCellCount : renderedPointCount,
    series: seriesPlans,
    warnings,
  }
}

export function addScatterPlotToCommandList(
  commands: RenderCommandList,
  plan: ScatterPlotRenderPlan,
  z: ZLayer = ZLayer.Fill,
): void {
  for (const series of plan.series) {
    if (plan.mode === 'density') {
      for (const cell of series.densityCells) {
        commands.addRect(cell.x, cell.y, cell.width, cell.height, cell.style, z)
      }
    } else {
      for (const point of series.points) {
        commands.addRect(point.x, point.y, point.width, point.height, point.style, z)
      }
    }
  }
}

export function createScatterPlotViewTransform(
  plan: ScatterPlotRenderPlan,
  width: number,
  height: number,
): ViewTransform {
  return createViewportTransform(plan.xRelativeRange, plan.yRange, width, height)
}

export function buildScatterPlotCommandFrame(
  plan: ScatterPlotRenderPlan,
  width: number,
  height: number,
  options: ScatterPlotFrameOptions = {},
): ScatterPlotCommandFrame {
  const layout = resolveChartLayout(options.layout, width, height, plan.xRelativeRange, plan.yRange)
  const transform = layout
    ? createPlotViewportTransform(plan.xRelativeRange, plan.yRange, width, height, layout.plotArea)
    : createScatterPlotViewTransform(plan, width, height)
  const commands = new RenderCommandList()
  if (layout && options.guides !== false) {
    addChartGuidesToCommandList(commands, layout, plan.xRelativeRange, plan.yRange, options.guides)
  }
  addScatterPlotToCommandList(commands, plan)

  return {
    width,
    height,
    layout,
    commands,
    transform,
  }
}

export function renderScatterPlotPlan(
  context: RenderContext,
  plan: ScatterPlotRenderPlan,
  options: ScatterPlotFrameOptions = {},
): void {
  const frame = buildScatterPlotCommandFrame(plan, context.width, context.height, options)
  context.setTransform(frame.transform)
  context.beginFrame()
  drawCommandList(context, frame.commands)
  context.endFrame()
}

function resolveScatterMode(input: {
  densityEnabled: boolean | undefined
  filteredPointCount: number
  maxRenderedPoints: number
  minPointCount: number
}): ScatterPlotMode {
  if (input.densityEnabled === false) return 'points'
  if (input.densityEnabled === true) {
    return input.filteredPointCount >= input.minPointCount ? 'density' : 'points'
  }
  return input.filteredPointCount > input.maxRenderedPoints ? 'density' : 'points'
}

function buildPointSeries(
  source: ScatterPlotSeries,
  options: {
    color: RgbaColor
    filteredPointCount: number
    maxRenderedPoints: number
    pointSize: number
    sourceCount: number
    xOrigin: number
    xRange: NumericRange
    yRange: NumericRange
  },
): ScatterPlannedSeries {
  const step = Math.max(1, Math.ceil(options.filteredPointCount / options.maxRenderedPoints))
  const xSpan = Math.max(Number.EPSILON, options.xRange[1] - options.xRange[0])
  const ySpan = Math.max(Number.EPSILON, options.yRange[1] - options.yRange[0])
  const width = (xSpan / 900) * Math.max(1, options.pointSize)
  const height = (ySpan / 520) * Math.max(1, options.pointSize)
  const points: ScatterPlannedPoint[] = []
  let accepted = 0

  for (let index = 0; index < options.sourceCount; index++) {
    const x = source.x[index]
    const y = source.y[index]
    if (
      !isFiniteNumber(x) ||
      !isFiniteNumber(y) ||
      !isPointInRange(x, y, options.xRange, options.yRange)
    ) {
      continue
    }
    if (accepted % step === 0) {
      points.push({
        seriesKey: source.key,
        sourceIndex: index,
        x: x - options.xOrigin - width / 2,
        y: y - height / 2,
        width,
        height,
        style: { fillColor: withAlpha(options.color, Math.min(0.82, options.color[3])) },
      })
    }
    accepted += 1
  }

  return {
    key: source.key,
    label: source.label,
    sourcePointCount: options.sourceCount,
    filteredPointCount: options.filteredPointCount,
    renderedPointCount: points.length,
    densityCellCount: 0,
    mode: 'points',
    color: options.color,
    points,
    densityCells: [],
  }
}

function buildDensitySeries(
  source: ScatterPlotSeries,
  options: {
    color: RgbaColor
    columns: number
    rows: number
    sourceCount: number
    xOrigin: number
    xRange: NumericRange
    yRange: NumericRange
    minAlpha: number
    maxAlpha: number
  },
): ScatterPlannedSeries {
  const cellCount = options.columns * options.rows
  const counts = new Uint32Array(cellCount)
  const touched: number[] = []
  const xValues = source.x
  const yValues = source.y
  const sourceCount = options.sourceCount
  const columns = options.columns
  const rows = options.rows
  const xMin = options.xRange[0]
  const xMax = options.xRange[1]
  const yMin = options.yRange[0]
  const yMax = options.yRange[1]
  const xSpan = Math.max(Number.EPSILON, xMax - xMin)
  const ySpan = Math.max(Number.EPSILON, yMax - yMin)
  const cellWidth = xSpan / columns
  const cellHeight = ySpan / rows
  const finiteBounds =
    Number.isFinite(xMin) &&
    Number.isFinite(xMax) &&
    Number.isFinite(yMin) &&
    Number.isFinite(yMax) &&
    Number.isFinite(xSpan) &&
    Number.isFinite(ySpan) &&
    Number.isFinite(columns) &&
    Number.isFinite(rows)
  let filteredPointCount = 0
  let maxCount = 0

  for (let index = 0; index < sourceCount; index++) {
    const x = xValues[index] as number
    const y = yValues[index] as number
    if (
      !(x >= xMin && x <= xMax && y >= yMin && y <= yMax) ||
      (!finiteBounds && (!isFiniteNumber(x) || !isFiniteNumber(y)))
    ) {
      continue
    }
    // Finite inclusive bounds already reject invalid values and negative bins.
    // Retain division before multiplication to preserve exact bin boundaries.
    const columnValue = Math.floor(((x - xMin) / xSpan) * columns)
    const rowValue = Math.floor(((y - yMin) / ySpan) * rows)
    const column = finiteBounds
      ? Math.min(columns - 1, columnValue)
      : clamp(columnValue, 0, columns - 1)
    const row = finiteBounds ? Math.min(rows - 1, rowValue) : clamp(rowValue, 0, rows - 1)
    const cellIndex = row * columns + column
    const current = counts[cellIndex] ?? 0
    if (current === 0) touched.push(cellIndex)
    const next = current + 1
    counts[cellIndex] = next
    if (next > maxCount) maxCount = next
    filteredPointCount += 1
  }

  const cells: ScatterDensityCell[] = []
  const alphaSpan = Math.max(0, options.maxAlpha - options.minAlpha)
  const logMax = Math.log1p(maxCount)

  for (let index = 0; index < touched.length; index++) {
    const cellIndex = touched[index] as number
    const count = counts[cellIndex] as number
    const column = cellIndex % options.columns
    const row = Math.floor(cellIndex / options.columns)
    const alpha =
      logMax > 0 ? options.minAlpha + (Math.log1p(count) / logMax) * alphaSpan : options.minAlpha

    cells.push({
      seriesKey: source.key,
      column,
      row,
      count,
      x: xMin - options.xOrigin + column * cellWidth,
      y: yMin + row * cellHeight,
      width: cellWidth,
      height: cellHeight,
      style: { fillColor: withAlpha(options.color, alpha) },
    })
  }

  return {
    key: source.key,
    label: source.label,
    sourcePointCount: options.sourceCount,
    filteredPointCount,
    renderedPointCount: filteredPointCount,
    densityCellCount: cells.length,
    mode: 'density',
    color: options.color,
    points: [],
    densityCells: cells,
  }
}

function countFilteredScatterPoints(
  series: readonly ScatterPlotSeries[],
  xRange: NumericRange,
  yRange: NumericRange,
  stopAt: number,
): number {
  let count = 0
  for (const item of series) {
    const sourceCount = Math.min(item.x.length, item.y.length)
    count += countFilteredSeriesPoints(item, sourceCount, xRange, yRange, stopAt - count)
    if (count >= stopAt) return count
  }
  return count
}

function countFilteredSeriesPoints(
  series: ScatterPlotSeries,
  sourceCount: number,
  xRange: NumericRange,
  yRange: NumericRange,
  stopAt = Number.POSITIVE_INFINITY,
): number {
  const xValues = series.x
  const yValues = series.y
  const xMin = xRange[0]
  const xMax = xRange[1]
  const yMin = yRange[0]
  const yMax = yRange[1]
  let count = 0
  for (let index = 0; index < sourceCount; index++) {
    const x = xValues[index]
    const y = yValues[index]
    if (
      isFiniteNumber(x) &&
      isFiniteNumber(y) &&
      x >= xMin &&
      x <= xMax &&
      y >= yMin &&
      y <= yMax
    ) {
      count += 1
      if (count >= stopAt) return count
    }
  }
  return count
}

function inferScatterRange(
  series: readonly ScatterPlotSeries[],
  axis: 'x' | 'y',
  paddingRatio: number,
): NumericRange {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (const item of series) {
    const values = axis === 'x' ? item.x : item.y
    for (let index = 0; index < values.length; index++) {
      const value = values[index]
      if (!isFiniteNumber(value)) continue
      if (value < min) min = value
      if (value > max) max = value
    }
  }

  if (min === Number.POSITIVE_INFINITY) return [0, 1]
  return expandRange([min, max], paddingRatio)
}

function isPointInRange(x: number, y: number, xRange: NumericRange, yRange: NumericRange): boolean {
  return x >= xRange[0] && x <= xRange[1] && y >= yRange[0] && y <= yRange[1]
}

function withAlpha(color: RgbaColor, alpha: number): RgbaColor {
  return [color[0], color[1], color[2], clamp(alpha, 0, 1)]
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}
