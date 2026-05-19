import { RenderCommandList, ZLayer } from '../renderer/render-command-list.js'
import type { LineOptions, RectOptions, RenderContext, TextOptions } from '../renderer/types.js'
import type { ViewTransform } from '../renderer/view-transform.js'
import {
  type ChartLayout,
  type ChartLayoutOptions,
  createPlotViewportTransform,
  createViewportTransform,
  drawCommandList,
  isFiniteNumber,
  type NumericRange,
  normalizeRange,
  type RgbaColor,
  resolveChartLayout,
} from './common.js'

export type KpiStatus = 'normal' | 'warning' | 'alarm' | 'stale' | 'offline' | 'unknown'

export interface KpiSparkline {
  values: Float32Array | Float64Array
  valueRange?: NumericRange
  color?: RgbaColor
  width?: number
  visible?: boolean
}

export interface KpiStripItem {
  key: string
  label: string
  value: number
  unit?: string
  status?: KpiStatus
  freshnessSeconds?: number
  quality?: number
  sparkline?: KpiSparkline
  target?: number
  lowerLimit?: number
  upperLimit?: number
  visible?: boolean
}

export interface KpiStripDataSet {
  items: readonly KpiStripItem[]
}

export interface KpiStripRenderOptions {
  columns?: number
  maxItems?: number
  includeHidden?: boolean
  sparklinePointLimit?: number
  cardGapRatio?: number
  cardPaddingRatio?: number
  backgroundColor?: RgbaColor
  borderColor?: RgbaColor
}

export interface KpiPlannedItem {
  key: string
  label: string
  value: number
  unit: string
  status: KpiStatus
  freshnessSeconds: number | null
  quality: number | null
  x: number
  y: number
  width: number
  height: number
  background: RectOptions
  statusRail: RectOptions
  sparkline: Float32Array
  sparklineStyle: LineOptions
  targetLine: Float32Array | null
  limitLines: readonly Float32Array[]
}

export interface KpiStripRenderPlan {
  kind: 'kpi-strip'
  xRange: NumericRange
  xOrigin: number
  xRelativeRange: NumericRange
  yRange: NumericRange
  columns: number
  rows: number
  sourceItemCount: number
  renderedItemCount: number
  sparklinePointCount: number
  statusCounts: Readonly<Record<KpiStatus, number>>
  commandCount: number
  items: readonly KpiPlannedItem[]
  warnings: readonly string[]
}

export interface KpiStripFrameOptions {
  layout?: ChartLayout | ChartLayoutOptions
  labels?: boolean
  maxLabelCount?: number
}

export interface KpiStripCommandFrame {
  width: number
  height: number
  layout: ChartLayout | null
  commands: RenderCommandList
  transform: ViewTransform
}

const DEFAULT_BACKGROUND: RgbaColor = [1, 1, 1, 0.92]
const DEFAULT_BORDER: RgbaColor = [0.13, 0.16, 0.22, 0.14]
const DEFAULT_SPARKLINE: RgbaColor = [0.15, 0.39, 0.92, 0.92]
const TARGET_COLOR: RgbaColor = [0.1, 0.1, 0.1, 0.45]
const LIMIT_COLOR: RgbaColor = [0.86, 0.15, 0.15, 0.42]
const STATUS_COLORS: Readonly<Record<KpiStatus, RgbaColor>> = {
  normal: [0.09, 0.64, 0.29, 0.9],
  warning: [0.93, 0.47, 0.09, 0.92],
  alarm: [0.86, 0.15, 0.15, 0.92],
  stale: [0.42, 0.46, 0.55, 0.78],
  offline: [0.12, 0.13, 0.15, 0.82],
  unknown: [0.5, 0.54, 0.62, 0.74],
}

const EMPTY_COUNTS: Readonly<Record<KpiStatus, number>> = {
  normal: 0,
  warning: 0,
  alarm: 0,
  stale: 0,
  offline: 0,
  unknown: 0,
}

export function buildKpiStripRenderPlan(
  data: KpiStripDataSet,
  options: KpiStripRenderOptions = {},
): KpiStripRenderPlan {
  const warnings: string[] = []
  const maxItems = Math.max(0, Math.floor(options.maxItems ?? Number.POSITIVE_INFINITY))
  const visibleItems = data.items
    .filter((item) => item.visible !== false || options.includeHidden === true)
    .slice(0, maxItems)
  const sourceItemCount = data.items.length
  const renderedItemCount = visibleItems.length
  const columns = resolveColumnCount(options.columns, renderedItemCount)
  const rows = Math.max(1, Math.ceil(renderedItemCount / columns))
  const xRange = [0, columns] as const
  const yRange = [0, rows] as const
  const gap = clamp(options.cardGapRatio ?? 0.08, 0, 0.36)
  const padding = clamp(options.cardPaddingRatio ?? 0.12, 0.02, 0.32)
  const backgroundColor = options.backgroundColor ?? DEFAULT_BACKGROUND
  const borderColor = options.borderColor ?? DEFAULT_BORDER
  const sparklinePointLimit = Math.max(2, Math.floor(options.sparklinePointLimit ?? 64))
  const counts: Record<KpiStatus, number> = { ...EMPTY_COUNTS }
  const items: KpiPlannedItem[] = []
  let sparklinePointCount = 0
  let commandCount = 0

  for (let index = 0; index < visibleItems.length; index++) {
    const source = visibleItems[index] as KpiStripItem
    const column = index % columns
    const row = Math.floor(index / columns)
    const status = normalizeStatus(source.status)
    counts[status] += 1

    const cellX = column
    const cellY = rows - row - 1
    const cardX = cellX + gap / 2
    const cardY = cellY + gap / 2
    const cardWidth = 1 - gap
    const cardHeight = 1 - gap
    const innerX = cardX + padding
    const innerY = cardY + padding
    const innerWidth = Math.max(0.05, cardWidth - padding * 2)
    const innerHeight = Math.max(0.05, cardHeight - padding * 2)
    const sparklineBox = {
      x: innerX,
      y: innerY + innerHeight * 0.42,
      width: innerWidth,
      height: innerHeight * 0.46,
    }
    const sparkline = buildSparklineBuffer(
      source.sparkline,
      sparklineBox,
      sparklinePointLimit,
      warnings,
      source.key,
    )
    sparklinePointCount += sparkline.length / 2

    const targetLine =
      source.target !== undefined
        ? buildHorizontalValueLine(source.target, source.sparkline?.valueRange, sparklineBox)
        : null
    const limitLines: Float32Array[] = []
    if (source.lowerLimit !== undefined) {
      limitLines.push(
        buildHorizontalValueLine(source.lowerLimit, source.sparkline?.valueRange, sparklineBox),
      )
    }
    if (source.upperLimit !== undefined) {
      limitLines.push(
        buildHorizontalValueLine(source.upperLimit, source.sparkline?.valueRange, sparklineBox),
      )
    }

    commandCount += 2
    if (sparkline.length > 0) commandCount += 1
    if (targetLine) commandCount += 1
    commandCount += limitLines.length

    items.push({
      key: source.key,
      label: source.label,
      value: isFiniteNumber(source.value) ? source.value : Number.NaN,
      unit: source.unit ?? '',
      status,
      freshnessSeconds: nullableFinite(source.freshnessSeconds),
      quality: nullableFinite(source.quality),
      x: cardX,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
      background: {
        fillColor: backgroundColor,
        strokeColor: borderColor,
        strokeWidth: 0.02,
      },
      statusRail: {
        fillColor: STATUS_COLORS[status],
      },
      sparkline,
      sparklineStyle: {
        color: source.sparkline?.color ?? DEFAULT_SPARKLINE,
        width: source.sparkline?.width ?? 0.02,
        cap: 'round',
        join: 'round',
      },
      targetLine,
      limitLines,
    })
  }

  return {
    kind: 'kpi-strip',
    xRange,
    xOrigin: 0,
    xRelativeRange: xRange,
    yRange,
    columns,
    rows,
    sourceItemCount,
    renderedItemCount,
    sparklinePointCount,
    statusCounts: counts,
    commandCount,
    items,
    warnings,
  }
}

export function addKpiStripToCommandList(
  commands: RenderCommandList,
  plan: KpiStripRenderPlan,
): void {
  for (const item of plan.items) {
    commands.addRect(item.x, item.y, item.width, item.height, item.background, ZLayer.Fill)
    commands.addRect(
      item.x,
      item.y,
      item.width * 0.045,
      item.height,
      item.statusRail,
      ZLayer.Overlay,
    )
    for (const limitLine of item.limitLines) {
      commands.addLine(limitLine, { color: LIMIT_COLOR, width: 0.012 }, ZLayer.Overlay)
    }
    if (item.targetLine) {
      commands.addLine(item.targetLine, { color: TARGET_COLOR, width: 0.012 }, ZLayer.Overlay)
    }
    if (item.sparkline.length > 0) {
      commands.addLine(item.sparkline, item.sparklineStyle, ZLayer.Line)
    }
  }
}

export function createKpiStripViewTransform(
  plan: KpiStripRenderPlan,
  width: number,
  height: number,
): ViewTransform {
  return createViewportTransform(plan.xRelativeRange, plan.yRange, width, height)
}

export function buildKpiStripCommandFrame(
  plan: KpiStripRenderPlan,
  width: number,
  height: number,
  options: KpiStripFrameOptions = {},
): KpiStripCommandFrame {
  const layout = resolveChartLayout(options.layout, width, height, plan.xRelativeRange, plan.yRange)
  const transform = layout
    ? createPlotViewportTransform(plan.xRelativeRange, plan.yRange, width, height, layout.plotArea)
    : createKpiStripViewTransform(plan, width, height)
  const commands = new RenderCommandList()
  addKpiStripToCommandList(commands, plan)
  if (options.labels !== false) {
    addKpiLabelsToCommandList(commands, plan, transform, options.maxLabelCount ?? 64)
  }

  return {
    width,
    height,
    layout,
    commands,
    transform,
  }
}

export function renderKpiStripPlan(
  context: RenderContext,
  plan: KpiStripRenderPlan,
  options: KpiStripFrameOptions = {},
): void {
  const frame = buildKpiStripCommandFrame(plan, context.width, context.height, options)
  context.setTransform(frame.transform)
  context.beginFrame()
  drawCommandList(context, frame.commands)
  context.endFrame()
}

function resolveColumnCount(columns: number | undefined, itemCount: number): number {
  if (columns !== undefined) return Math.max(1, Math.floor(columns))
  if (itemCount <= 4) return Math.max(1, itemCount)
  return Math.max(1, Math.ceil(Math.sqrt(itemCount * 1.6)))
}

function buildSparklineBuffer(
  sparkline: KpiSparkline | undefined,
  box: { x: number; y: number; width: number; height: number },
  pointLimit: number,
  warnings: string[],
  key: string,
): Float32Array {
  if (!sparkline || sparkline.visible === false) return new Float32Array(0)
  const values = sparkline.values
  const sourceCount = values.length
  if (sourceCount < 2) return new Float32Array(0)

  const outputCount = Math.min(pointLimit, sourceCount)
  const output = new Float32Array(outputCount * 2)
  const range = sparkline.valueRange
    ? normalizeRange(sparkline.valueRange)
    : inferValueRange(values)
  const span = Math.max(Number.EPSILON, range[1] - range[0])
  if (range[0] === range[1]) {
    warnings.push(`KPI "${key}" sparkline uses a flat range.`)
  }

  for (let outputIndex = 0; outputIndex < outputCount; outputIndex++) {
    const sourceIndex =
      outputCount === sourceCount
        ? outputIndex
        : Math.min(
            sourceCount - 1,
            Math.floor((outputIndex / (outputCount - 1)) * (sourceCount - 1)),
          )
    const raw = values[sourceIndex]
    const normalized = isFiniteNumber(raw) ? clamp((raw - range[0]) / span, 0, 1) : 0.5
    output[outputIndex * 2] = box.x + (outputIndex / Math.max(1, outputCount - 1)) * box.width
    output[outputIndex * 2 + 1] = box.y + (1 - normalized) * box.height
  }

  return output
}

function buildHorizontalValueLine(
  value: number,
  valueRange: NumericRange | undefined,
  box: { x: number; y: number; width: number; height: number },
): Float32Array {
  const range = valueRange ? normalizeRange(valueRange) : [0, 1]
  const span = Math.max(Number.EPSILON, range[1] - range[0])
  const normalized = clamp((value - range[0]) / span, 0, 1)
  const y = box.y + (1 - normalized) * box.height
  return new Float32Array([box.x, y, box.x + box.width, y])
}

function addKpiLabelsToCommandList(
  commands: RenderCommandList,
  plan: KpiStripRenderPlan,
  transform: ViewTransform,
  maxLabelCount: number,
): void {
  if (plan.renderedItemCount === 0 || plan.renderedItemCount > maxLabelCount) return

  const labelStyle: TextOptions = {
    color: [0.1, 0.12, 0.16, 0.78],
    font: 'system-ui, sans-serif',
    fontSize: 11,
    align: 'left',
    baseline: 'top',
  }
  const valueStyle: TextOptions = {
    color: [0.04, 0.06, 0.1, 0.92],
    font: 'system-ui, sans-serif',
    fontSize: 14,
    align: 'left',
    baseline: 'top',
  }

  for (const item of plan.items) {
    const labelPoint = transform.dataToPixel(
      item.x + item.width * 0.12,
      item.y + item.height * 0.78,
    )
    const valuePoint = transform.dataToPixel(
      item.x + item.width * 0.12,
      item.y + item.height * 0.58,
    )
    commands.addText(item.label, labelPoint.x, labelPoint.y, labelStyle, ZLayer.Text)
    commands.addText(formatKpiValue(item), valuePoint.x, valuePoint.y, valueStyle, ZLayer.Text)
  }
}

function formatKpiValue(item: KpiPlannedItem): string {
  if (!isFiniteNumber(item.value)) return item.unit ? `-- ${item.unit}` : '--'
  const absolute = Math.abs(item.value)
  const digits = absolute >= 100 ? 0 : absolute >= 10 ? 1 : 2
  return `${item.value.toFixed(digits)}${item.unit ? ` ${item.unit}` : ''}`
}

function inferValueRange(values: Float32Array | Float64Array): NumericRange {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (let index = 0; index < values.length; index++) {
    const value = values[index]
    if (!isFiniteNumber(value)) continue
    if (value < min) min = value
    if (value > max) max = value
  }
  if (min === Number.POSITIVE_INFINITY) return [0, 1]
  if (min === max) return [min - 1, max + 1]
  const padding = (max - min) * 0.08
  return [min - padding, max + padding]
}

function normalizeStatus(status: KpiStatus | undefined): KpiStatus {
  return status ?? 'unknown'
}

function nullableFinite(value: number | undefined): number | null {
  return isFiniteNumber(value) ? value : null
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}
