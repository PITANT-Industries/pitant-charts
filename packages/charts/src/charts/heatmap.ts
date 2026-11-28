import type { RenderContext, RendererType } from '../renderer/types.js'
import { type ChartFrameOptions, renderChartFrame } from './chart-frame.js'
import {
  type ChartLayoutOptions,
  expandRange,
  type NumericRange,
  normalizeRange,
  type RgbaColor,
  relativeRange,
} from './common.js'
import { createImperativeChart, ImperativeChart } from './imperative-chart.js'
import {
  buildSpectrogramCommandFrame,
  colorForValue,
  DEFAULT_MISSING_COLOR,
  normalizeColorStops,
  type SpectrogramColorStop,
  type SpectrogramCommandFrame,
  type SpectrogramPlannedTile,
  type SpectrogramRenderOptions,
  type TileRenderPlan,
} from './spectrogram.js'

interface HeatmapColors {
  colorStops?: readonly SpectrogramColorStop[]
  missingColor?: RgbaColor
}

export interface HeatmapGridData extends HeatmapColors {
  /** Ascending cell boundaries, with one more edge than cells on each axis. */
  xEdges: Float64Array
  yEdges: Float64Array
  values: Float32Array | Float64Array
  /** In y-major order each row contains every X cell. */
  valueLayout?: 'x-major' | 'y-major'
}

export interface HeatmapCell {
  xRange: NumericRange
  yRange: NumericRange
  value: number
}

export interface HeatmapSparseData extends HeatmapColors {
  /** Only supplied cells occupy space. Each cell has its own X and Y bounds. */
  cells: readonly HeatmapCell[]
}

export type HeatmapDataSet = HeatmapGridData | HeatmapSparseData

export type HeatmapRenderOptions = SpectrogramRenderOptions

export interface HeatmapRenderPlan extends TileRenderPlan {
  kind: 'heatmap'
  yOrigin: number
  yRelativeRange: NumericRange
}

export type HeatmapFrameOptions = ChartFrameOptions<HeatmapRenderPlan>

type CellVisitor = (x: number, xEnd: number, y: number, yEnd: number, value: number) => void

export function buildHeatmapRenderPlan(
  data: HeatmapDataSet,
  options: HeatmapRenderOptions = {},
): HeatmapRenderPlan {
  const clipX = options.xRange ? normalizeRange(options.xRange) : undefined
  const clipY = options.yRange ? normalizeRange(options.yRange) : undefined
  const includeMissing = options.includeMissing === true
  const tiles: SpectrogramPlannedTile[] = []
  const warnings: string[] = []
  const extentX: [number, number] = [Infinity, -Infinity]
  const extentY: [number, number] = [Infinity, -Infinity]
  const extentZ: [number, number] = [Infinity, -Infinity]
  const sourceTileCount = visitCells(data, warnings, (x, xEnd, y, yEnd, value) => {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(xEnd) ||
      !Number.isFinite(y) ||
      !Number.isFinite(yEnd) ||
      xEnd <= x ||
      yEnd <= y
    )
      return
    includeExtent(extentX, x, xEnd)
    includeExtent(extentY, y, yEnd)
    const finite = Number.isFinite(value)
    if (!finite && !includeMissing) return
    const left = Math.max(x, clipX?.[0] ?? x)
    const right = Math.min(xEnd, clipX?.[1] ?? xEnd)
    const bottom = Math.max(y, clipY?.[0] ?? y)
    const top = Math.min(yEnd, clipY?.[1] ?? yEnd)
    if (right <= left || top <= bottom) return
    if (finite) includeExtent(extentZ, value, value)
    tiles.push({
      x: left,
      y: bottom,
      width: right - left,
      height: top - bottom,
      value: finite ? value : Number.NaN,
      style: {},
    })
  })

  const xRange = clipX ?? finiteExtent(extentX)
  const yRange = clipY ?? finiteExtent(extentY)
  const zRange = options.zRange
    ? normalizeRange(options.zRange)
    : expandRange(finiteExtent(extentZ), 0.001)
  const xOrigin = xRange[0]
  const yOrigin = yRange[0]
  const colorStops = normalizeColorStops(data.colorStops ?? options.defaultColorStops ?? [])
  const missingColor = data.missingColor ?? options.missingColor ?? DEFAULT_MISSING_COLOR
  for (const tile of tiles) {
    tile.x -= xOrigin
    tile.y -= yOrigin
    tile.style.fillColor = Number.isFinite(tile.value)
      ? colorForValue(tile.value, zRange, colorStops)
      : missingColor
  }
  return {
    kind: 'heatmap',
    xRange,
    xOrigin,
    xRelativeRange: relativeRange(xRange, xOrigin),
    yRange,
    yOrigin,
    yRelativeRange: relativeRange(yRange, yOrigin),
    zRange,
    sourceTileCount,
    includedTileCount: tiles.length,
    renderedTileCount: tiles.length,
    tiles,
    warnings,
  }
}

function includeExtent(extent: [number, number], low: number, high: number): void {
  if (low < extent[0]) extent[0] = low
  if (high > extent[1]) extent[1] = high
}

function finiteExtent(extent: NumericRange): NumericRange {
  return extent[0] === Infinity ? [0, 1] : extent
}

function visitCells(data: HeatmapDataSet, warnings: string[], visit: CellVisitor): number {
  if ('cells' in data) {
    for (const cell of data.cells) visit(...cell.xRange, ...cell.yRange, cell.value)
    return data.cells.length
  }
  const xCount = Math.max(0, data.xEdges.length - 1)
  const yCount = Math.max(0, data.yEdges.length - 1)
  const count = xCount * yCount
  if (data.values.length !== count) {
    warnings.push(`Heatmap values provide ${data.values.length} tiles for ${count} grid cells.`)
  }
  if (!validEdges(data.xEdges) || !validEdges(data.yEdges)) {
    warnings.push('Heatmap axis edges must be finite and strictly ascending.')
    return count
  }
  const xMajor = data.valueLayout === 'x-major'
  for (let iy = 0; iy < yCount; iy++) {
    const bottom = data.yEdges[iy] as number
    const top = data.yEdges[iy + 1] as number
    for (let ix = 0; ix < xCount; ix++) {
      const index = xMajor ? ix * yCount + iy : iy * xCount + ix
      visit(
        data.xEdges[ix] as number,
        data.xEdges[ix + 1] as number,
        bottom,
        top,
        data.values[index] ?? Number.NaN,
      )
    }
  }
  return count
}

function validEdges(edges: Float64Array): boolean {
  return edges.every(
    (edge, index) => Number.isFinite(edge) && (index === 0 || edge > (edges[index - 1] as number)),
  )
}

export function buildHeatmapCommandFrame(
  plan: HeatmapRenderPlan,
  width: number,
  height: number,
  options: HeatmapFrameOptions = {},
): SpectrogramCommandFrame {
  const layout = options.layout
  if (layout && 'plotArea' in layout)
    return buildSpectrogramCommandFrame(plan, width, height, options)
  const axes: ChartLayoutOptions = {
    width,
    height,
    ...layout,
    xRange: plan.xRelativeRange,
    yRange: plan.yRelativeRange,
    xAxis: { visible: true, ...layout?.xAxis, valueOffset: plan.xOrigin },
    yAxis: { visible: true, ...layout?.yAxis, valueOffset: plan.yOrigin },
  }
  return buildSpectrogramCommandFrame(plan, width, height, { ...options, layout: axes })
}

export function renderHeatmapPlan(
  context: RenderContext,
  plan: HeatmapRenderPlan,
  options: HeatmapFrameOptions = {},
): void {
  const frame = buildHeatmapCommandFrame(plan, context.width, context.height, options)
  renderChartFrame(context, frame, plan, options.plugins, true)
}

export interface HeatmapChartOptions {
  data: HeatmapDataSet
  render?: HeatmapRenderOptions
  frame?: HeatmapFrameOptions
  autoRender?: boolean
  ownsContext?: boolean
}

export interface HeatmapChartCreateOptions extends Omit<HeatmapChartOptions, 'ownsContext'> {
  renderer?: RendererType | 'auto'
}

export class HeatmapChart extends ImperativeChart<
  HeatmapDataSet,
  HeatmapRenderOptions,
  HeatmapFrameOptions,
  HeatmapRenderPlan
> {
  constructor(context: RenderContext, options: HeatmapChartOptions) {
    super(
      context,
      { ...options, render: options.render ?? {}, frame: options.frame ?? {} },
      {
        name: 'HeatmapChart',
        buildPlan: buildHeatmapRenderPlan,
        buildFrame: buildHeatmapCommandFrame,
        clipPlot: () => true,
      },
    )
  }

  static create(
    canvas: HTMLCanvasElement,
    options: HeatmapChartCreateOptions,
  ): Promise<HeatmapChart> {
    return createImperativeChart(HeatmapChart, canvas, options)
  }
}
