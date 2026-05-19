import { RenderCommandList, ZLayer } from '../renderer/render-command-list.js'
import type { RectOptions, RenderContext, TextOptions } from '../renderer/types.js'
import type { ViewTransform } from '../renderer/view-transform.js'
import {
  addChartGuidesToCommandList,
  type ChartGuideOptions,
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

export type CorrelationMatrixValueLayout = 'row-major' | 'column-major'
export type CorrelationCellState = 'valid' | 'missing' | 'low-sample' | 'masked' | 'self'

export interface CorrelationVariable {
  key: string
  label: string
  unit?: string
  visible?: boolean
}

export interface CorrelationColorStop {
  value: number
  color: RgbaColor
}

export interface CorrelationMatrixDataSet {
  variables: readonly CorrelationVariable[]
  values: Float32Array | Float64Array
  sampleCounts?: Uint16Array | Uint32Array | Int32Array | Float64Array
  missingCounts?: Uint16Array | Uint32Array | Int32Array | Float64Array
  mask?: Uint8Array
  valueLayout?: CorrelationMatrixValueLayout
  colorStops?: readonly CorrelationColorStop[]
  missingColor?: RgbaColor
  lowSampleColor?: RgbaColor
  maskedColor?: RgbaColor
  diagonalColor?: RgbaColor
}

export interface CorrelationMatrixRenderOptions {
  rowRange?: NumericRange
  columnRange?: NumericRange
  valueRange?: NumericRange
  minSampleCount?: number
  includeHidden?: boolean
  includeDiagonal?: boolean
  defaultColorStops?: readonly CorrelationColorStop[]
  missingColor?: RgbaColor
  lowSampleColor?: RgbaColor
  maskedColor?: RgbaColor
  diagonalColor?: RgbaColor
}

export interface CorrelationPlannedCell {
  row: number
  column: number
  sourceRow: number
  sourceColumn: number
  rowKey: string
  columnKey: string
  value: number
  sampleCount: number | null
  missingCount: number | null
  state: CorrelationCellState
  x: number
  y: number
  width: number
  height: number
  style: RectOptions
}

export interface CorrelationMatrixRenderPlan {
  kind: 'correlation-matrix'
  xRange: NumericRange
  xOrigin: number
  xRelativeRange: NumericRange
  yRange: NumericRange
  valueRange: NumericRange
  variables: readonly CorrelationVariable[]
  sourceVariableCount: number
  visibleVariableCount: number
  sourceCellCount: number
  renderedCellCount: number
  missingCellCount: number
  lowSampleCellCount: number
  maskedCellCount: number
  cells: readonly CorrelationPlannedCell[]
  warnings: readonly string[]
}

export interface CorrelationMatrixFrameOptions {
  layout?: ChartLayout | ChartLayoutOptions
  guides?: ChartGuideOptions | false
  labels?: boolean
  maxLabelCount?: number
}

export interface CorrelationMatrixCommandFrame {
  width: number
  height: number
  layout: ChartLayout | null
  commands: RenderCommandList
  transform: ViewTransform
}

const DEFAULT_COLOR_STOPS: readonly CorrelationColorStop[] = [
  { value: -1, color: [0.15, 0.39, 0.92, 1] },
  { value: -0.35, color: [0.5, 0.67, 0.95, 1] },
  { value: 0, color: [0.96, 0.97, 0.98, 1] },
  { value: 0.35, color: [0.96, 0.62, 0.45, 1] },
  { value: 1, color: [0.86, 0.15, 0.15, 1] },
]
const DEFAULT_MISSING_COLOR: RgbaColor = [0.13, 0.15, 0.18, 0.18]
const DEFAULT_LOW_SAMPLE_COLOR: RgbaColor = [0.93, 0.47, 0.09, 0.46]
const DEFAULT_MASKED_COLOR: RgbaColor = [0.38, 0.42, 0.5, 0.12]
const DEFAULT_DIAGONAL_COLOR: RgbaColor = [0.11, 0.14, 0.18, 0.82]

export function buildCorrelationMatrixRenderPlan(
  data: CorrelationMatrixDataSet,
  options: CorrelationMatrixRenderOptions = {},
): CorrelationMatrixRenderPlan {
  const sourceVariableCount = data.variables.length
  const sourceCellCount = sourceVariableCount * sourceVariableCount
  const warnings: string[] = []

  if (data.values.length < sourceCellCount) {
    warnings.push(
      `Correlation matrix values provide ${data.values.length} cells for ${sourceCellCount} variable pairs.`,
    )
  }
  if (data.sampleCounts !== undefined && data.sampleCounts.length < sourceCellCount) {
    warnings.push(
      `Correlation matrix sample counts provide ${data.sampleCounts.length} cells for ${sourceCellCount} variable pairs.`,
    )
  }
  if (data.missingCounts !== undefined && data.missingCounts.length < sourceCellCount) {
    warnings.push(
      `Correlation matrix missing counts provide ${data.missingCounts.length} cells for ${sourceCellCount} variable pairs.`,
    )
  }

  const variableIndexes = visibleVariableIndexes(data.variables, options.includeHidden === true)
  const visibleVariables = variableIndexes.map(
    (index) => data.variables[index] as CorrelationVariable,
  )
  const visibleVariableCount = visibleVariables.length
  const xRange = options.columnRange
    ? clampIndexRange(options.columnRange, visibleVariableCount)
    : ([0, visibleVariableCount] as const)
  const rowIndexRange = options.rowRange
    ? clampIndexRange(options.rowRange, visibleVariableCount)
    : ([0, visibleVariableCount] as const)
  const yRange = rowIndexRangeToYRange(rowIndexRange, visibleVariableCount)
  const valueRange = options.valueRange ? normalizeRange(options.valueRange) : ([-1, 1] as const)
  const colorStops = normalizeColorStops(
    data.colorStops ?? options.defaultColorStops ?? DEFAULT_COLOR_STOPS,
  )
  const missingColor = data.missingColor ?? options.missingColor ?? DEFAULT_MISSING_COLOR
  const lowSampleColor = data.lowSampleColor ?? options.lowSampleColor ?? DEFAULT_LOW_SAMPLE_COLOR
  const maskedColor = data.maskedColor ?? options.maskedColor ?? DEFAULT_MASKED_COLOR
  const diagonalColor = data.diagonalColor ?? options.diagonalColor ?? DEFAULT_DIAGONAL_COLOR
  const minSampleCount = Math.max(0, options.minSampleCount ?? 0)
  const includeDiagonal = options.includeDiagonal !== false
  const layout = data.valueLayout ?? 'row-major'
  const cells: CorrelationPlannedCell[] = []
  let missingCellCount = 0
  let lowSampleCellCount = 0
  let maskedCellCount = 0

  const startColumn = Math.max(0, Math.floor(xRange[0]))
  const endColumn = Math.min(visibleVariableCount, Math.ceil(xRange[1]))
  const startRow = Math.max(0, Math.floor(rowIndexRange[0]))
  const endRow = Math.min(visibleVariableCount, Math.ceil(rowIndexRange[1]))

  for (let row = startRow; row < endRow; row++) {
    const sourceRow = variableIndexes[row]
    const rowVariable = visibleVariables[row]
    if (sourceRow === undefined || rowVariable === undefined) continue

    for (let column = startColumn; column < endColumn; column++) {
      const sourceColumn = variableIndexes[column]
      const columnVariable = visibleVariables[column]
      if (sourceColumn === undefined || columnVariable === undefined) continue
      if (sourceRow === sourceColumn && !includeDiagonal) continue

      const valueIndex = correlationValueIndex(layout, sourceRow, sourceColumn, sourceVariableCount)
      const rawValue = data.values[valueIndex]
      const sampleCount = nullableFinite(data.sampleCounts?.[valueIndex])
      const missingCount = nullableFinite(data.missingCounts?.[valueIndex])
      const masked = data.mask?.[valueIndex] === 1
      const finiteValue = isFiniteNumber(rawValue)
        ? clamp(rawValue, valueRange[0], valueRange[1])
        : Number.NaN
      const state = resolveCellState({
        finite: isFiniteNumber(rawValue),
        masked,
        minSampleCount,
        sampleCount,
        self: sourceRow === sourceColumn,
      })

      if (state === 'missing') missingCellCount += 1
      if (state === 'low-sample') lowSampleCellCount += 1
      if (state === 'masked') maskedCellCount += 1

      cells.push({
        row,
        column,
        sourceRow,
        sourceColumn,
        rowKey: rowVariable.key,
        columnKey: columnVariable.key,
        value: finiteValue,
        sampleCount,
        missingCount,
        state,
        x: column,
        y: visibleVariableCount - row - 1,
        width: 1,
        height: 1,
        style: {
          fillColor:
            state === 'missing'
              ? missingColor
              : state === 'low-sample'
                ? lowSampleColor
                : state === 'masked'
                  ? maskedColor
                  : state === 'self'
                    ? diagonalColor
                    : colorForCorrelation(finiteValue, valueRange, colorStops),
          strokeColor: [1, 1, 1, 0.56],
          strokeWidth: 0.18,
        },
      })
    }
  }

  return {
    kind: 'correlation-matrix',
    xRange,
    xOrigin: 0,
    xRelativeRange: xRange,
    yRange,
    valueRange,
    variables: visibleVariables,
    sourceVariableCount,
    visibleVariableCount,
    sourceCellCount,
    renderedCellCount: cells.length,
    missingCellCount,
    lowSampleCellCount,
    maskedCellCount,
    cells,
    warnings,
  }
}

export function addCorrelationMatrixToCommandList(
  commands: RenderCommandList,
  plan: CorrelationMatrixRenderPlan,
  z: ZLayer = ZLayer.Fill,
): void {
  for (const cell of plan.cells) {
    commands.addRect(cell.x, cell.y, cell.width, cell.height, cell.style, z)
  }
}

export function createCorrelationMatrixViewTransform(
  plan: CorrelationMatrixRenderPlan,
  width: number,
  height: number,
): ViewTransform {
  return createViewportTransform(plan.xRelativeRange, plan.yRange, width, height)
}

export function buildCorrelationMatrixCommandFrame(
  plan: CorrelationMatrixRenderPlan,
  width: number,
  height: number,
  options: CorrelationMatrixFrameOptions = {},
): CorrelationMatrixCommandFrame {
  const layout = resolveChartLayout(options.layout, width, height, plan.xRelativeRange, plan.yRange)
  const transform = layout
    ? createPlotViewportTransform(plan.xRelativeRange, plan.yRange, width, height, layout.plotArea)
    : createCorrelationMatrixViewTransform(plan, width, height)
  const commands = new RenderCommandList()
  addCorrelationMatrixToCommandList(commands, plan)
  if (layout && options.guides !== false) {
    addChartGuidesToCommandList(commands, layout, plan.xRelativeRange, plan.yRange, options.guides)
  }
  if (layout && options.labels !== false) {
    addCorrelationMatrixLabelsToCommandList(
      commands,
      plan,
      transform,
      layout.plotArea,
      options.maxLabelCount ?? 24,
    )
  }

  return {
    width,
    height,
    layout,
    commands,
    transform,
  }
}

export function renderCorrelationMatrixPlan(
  context: RenderContext,
  plan: CorrelationMatrixRenderPlan,
  options: CorrelationMatrixFrameOptions = {},
): void {
  const frame = buildCorrelationMatrixCommandFrame(plan, context.width, context.height, options)
  context.setTransform(frame.transform)
  context.beginFrame()
  drawCommandList(context, frame.commands)
  context.endFrame()
}

function visibleVariableIndexes(
  variables: readonly CorrelationVariable[],
  includeHidden: boolean,
): number[] {
  const indexes: number[] = []
  for (let index = 0; index < variables.length; index++) {
    const variable = variables[index]
    if (!variable) continue
    if (variable.visible === false && !includeHidden) continue
    indexes.push(index)
  }
  return indexes
}

function clampIndexRange(range: NumericRange, count: number): NumericRange {
  const normalized = normalizeRange(range)
  return [clamp(normalized[0], 0, count), clamp(normalized[1], 0, count)]
}

function rowIndexRangeToYRange(rowRange: NumericRange, count: number): NumericRange {
  const start = clamp(rowRange[0], 0, count)
  const end = clamp(rowRange[1], 0, count)
  return [count - end, count - start]
}

function correlationValueIndex(
  layout: CorrelationMatrixValueLayout,
  row: number,
  column: number,
  size: number,
): number {
  return layout === 'column-major' ? column * size + row : row * size + column
}

function nullableFinite(value: number | undefined): number | null {
  return isFiniteNumber(value) ? value : null
}

function resolveCellState(input: {
  finite: boolean
  masked: boolean
  minSampleCount: number
  sampleCount: number | null
  self: boolean
}): CorrelationCellState {
  if (input.masked) return 'masked'
  if (!input.finite) return 'missing'
  if (input.sampleCount !== null && input.sampleCount < input.minSampleCount) return 'low-sample'
  if (input.self) return 'self'
  return 'valid'
}

function addCorrelationMatrixLabelsToCommandList(
  commands: RenderCommandList,
  plan: CorrelationMatrixRenderPlan,
  transform: ViewTransform,
  plotArea: { x: number; y: number; width: number; height: number },
  maxLabelCount: number,
): void {
  if (plan.visibleVariableCount === 0 || plan.visibleVariableCount > maxLabelCount) return

  const xStyle: TextOptions = {
    color: [0.12, 0.12, 0.12, 0.72],
    font: 'system-ui, sans-serif',
    fontSize: 10,
    align: 'center',
    baseline: 'top',
  }
  const yStyle: TextOptions = {
    color: [0.12, 0.12, 0.12, 0.72],
    font: 'system-ui, sans-serif',
    fontSize: 10,
    align: 'right',
    baseline: 'middle',
  }

  for (let index = 0; index < plan.variables.length; index++) {
    const variable = plan.variables[index]
    if (!variable) continue
    const xPoint = transform.dataToPixel(index + 0.5, plan.yRange[0])
    const yPoint = transform.dataToPixel(plan.xRange[0], plan.visibleVariableCount - index - 0.5)
    commands.addText(
      variable.label,
      clamp(xPoint.x, plotArea.x, plotArea.x + plotArea.width),
      plotArea.y + plotArea.height + 4,
      xStyle,
      ZLayer.Text,
    )
    commands.addText(
      variable.label,
      plotArea.x - 6,
      clamp(yPoint.y, plotArea.y + 4, plotArea.y + plotArea.height - 4),
      yStyle,
      ZLayer.Text,
    )
  }
}

function normalizeColorStops(
  stops: readonly CorrelationColorStop[],
): readonly CorrelationColorStop[] {
  if (stops.length === 0) return DEFAULT_COLOR_STOPS
  return [...stops].filter((stop) => isFiniteNumber(stop.value)).sort((a, b) => a.value - b.value)
}

function colorForCorrelation(
  value: number,
  valueRange: NumericRange,
  stops: readonly CorrelationColorStop[],
): RgbaColor {
  if (!isFiniteNumber(value)) return DEFAULT_MISSING_COLOR
  const span = Math.max(Number.EPSILON, valueRange[1] - valueRange[0])
  const normalized = clamp((value - valueRange[0]) / span, 0, 1)
  const scaledValue = valueRange[0] + normalized * span
  const fallbackLower = DEFAULT_COLOR_STOPS[0]
  const fallbackUpper = DEFAULT_COLOR_STOPS[DEFAULT_COLOR_STOPS.length - 1]
  if (!fallbackLower || !fallbackUpper) return [0, 0, 0, 1]
  let lower: CorrelationColorStop = stops[0] ?? fallbackLower
  let upper: CorrelationColorStop = stops[stops.length - 1] ?? fallbackUpper

  for (let index = 1; index < stops.length; index++) {
    const candidate = stops[index]
    if (!candidate) continue
    if (scaledValue <= candidate.value) {
      upper = candidate
      lower = stops[index - 1] ?? candidate
      break
    }
  }

  const stopSpan = Math.max(Number.EPSILON, upper.value - lower.value)
  const mix = clamp((scaledValue - lower.value) / stopSpan, 0, 1)
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
