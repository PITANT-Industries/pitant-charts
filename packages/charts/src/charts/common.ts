import { type RenderCommandList, ZLayer } from '../renderer/render-command-list.js'
import type { RenderContext } from '../renderer/types.js'
import { ViewTransform } from '../renderer/view-transform.js'

export type RgbaColor = readonly [r: number, g: number, b: number, a: number]
export type NumericRange = readonly [min: number, max: number]
export type LegendPosition = 'top' | 'right' | 'bottom' | 'left'

export interface ChartRect {
  x: number
  y: number
  width: number
  height: number
}

export interface EdgeInsets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface AxisLayoutOptions {
  visible?: boolean
  size?: number
  tickCount?: number
  label?: string
  formatValue?: (value: number) => string
}

export interface NamedYAxisLayoutOptions extends AxisLayoutOptions {
  key: string
  side?: 'left' | 'right'
  range?: NumericRange
}

export interface LegendLayoutOptions {
  visible?: boolean
  position?: LegendPosition
  size?: number
  gap?: number
}

export interface GridLayoutOptions {
  visible?: boolean
  xTickCount?: number
  yTickCount?: number
}

export interface ChartLayoutOptions {
  width: number
  height: number
  padding?: number | Partial<EdgeInsets>
  xRange?: NumericRange
  yRange?: NumericRange
  xAxis?: AxisLayoutOptions
  yAxis?: AxisLayoutOptions
  /** Additional layout contract for named axes. The first axis is primary. */
  yAxes?: readonly NamedYAxisLayoutOptions[]
  legend?: LegendLayoutOptions
  grid?: GridLayoutOptions
  minPlotWidth?: number
  minPlotHeight?: number
}

export interface AxisTick {
  value: number
  ratio: number
  position: number
  label: string
}

export interface LaidOutYAxis {
  key: string
  side: 'left' | 'right'
  area: ChartRect | null
  ticks: readonly AxisTick[]
  label: string | null
}

export interface ChartLayout {
  bounds: ChartRect
  contentArea: ChartRect
  plotArea: ChartRect
  overlayArea: ChartRect
  xAxisArea: ChartRect | null
  yAxisArea: ChartRect | null
  legendArea: ChartRect | null
  xAxisLabel: string | null
  yAxisLabel: string | null
  xTicks: readonly AxisTick[]
  yTicks: readonly AxisTick[]
  yAxes?: readonly LaidOutYAxis[]
}

export interface ChartGuideOptions {
  gridVisible?: boolean
  axesVisible?: boolean
  gridColor?: RgbaColor
  axisColor?: RgbaColor
  textColor?: RgbaColor
  gridLineWidth?: number
  axisLineWidth?: number
  textVisible?: boolean
  font?: string
  fontSize?: number
}

export const DEFAULT_CHART_COLORS: readonly RgbaColor[] = [
  [0.15, 0.39, 0.92, 1],
  [0.09, 0.64, 0.29, 1],
  [0.92, 0.55, 0.08, 1],
  [0.86, 0.15, 0.15, 1],
  [0.48, 0.23, 0.93, 1],
  [0.03, 0.58, 0.78, 1],
  [0.92, 0.35, 0.08, 1],
  [0.83, 0.14, 0.49, 1],
] as const

export function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function getDefaultColor(index: number, fallback?: RgbaColor): RgbaColor {
  return fallback ?? (DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length] as RgbaColor)
}

export function normalizeRange(range: NumericRange): NumericRange {
  const a = range[0]
  const b = range[1]
  return a <= b ? [a, b] : [b, a]
}

export function finiteRange(values: Float64Array): NumericRange {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (let i = 0; i < values.length; i++) {
    const value = values[i]
    if (!isFiniteNumber(value)) continue
    if (value < min) min = value
    if (value > max) max = value
  }

  if (min === Number.POSITIVE_INFINITY) return [0, 0]
  return [min, max]
}

export function expandRange(range: NumericRange, ratio: number): NumericRange {
  const [min, max] = normalizeRange(range)
  const span = max - min

  if (!Number.isFinite(span) || span < 0) return [0, 1]
  if (span === 0) {
    const base = Math.abs(min) > 1 ? Math.abs(min) : 1
    const pad = base * Math.max(ratio, 0.001)
    return [min - pad, max + pad]
  }

  const pad = span * Math.max(ratio, 0)
  return [min - pad, max + pad]
}

export function relativeRange(range: NumericRange, origin: number): NumericRange {
  return [range[0] - origin, range[1] - origin]
}

export function createViewportTransform(
  xRange: NumericRange,
  yRange: NumericRange,
  width: number,
  height: number,
): ViewTransform {
  const [xMin, xMax] = expandRange(xRange, 0)
  const [yMin, yMax] = expandRange(yRange, 0)
  const viewportWidth = Math.max(1, width)
  const viewportHeight = Math.max(1, height)
  const xSpan = Math.max(Number.EPSILON, xMax - xMin)
  const ySpan = Math.max(Number.EPSILON, yMax - yMin)
  const transform = new ViewTransform(viewportWidth, viewportHeight)

  transform.setScale(viewportWidth / xSpan, -viewportHeight / ySpan)
  transform.setTranslate(-xMin - xSpan / 2, -(yMax + yMin) / 2)

  return transform
}

export function createChartLayout(options: ChartLayoutOptions): ChartLayout {
  const bounds: ChartRect = {
    x: 0,
    y: 0,
    width: Math.max(1, options.width),
    height: Math.max(1, options.height),
  }
  const minPlotWidth = Math.max(1, options.minPlotWidth ?? 64)
  const minPlotHeight = Math.max(1, options.minPlotHeight ?? 48)
  const padding = resolveInsets(options.padding ?? 8)
  const contentArea = insetRect(bounds, padding)
  let plotArea = { ...contentArea }

  const legend = options.legend
  const legendVisible = legend?.visible === true
  const legendGap = Math.max(0, legend?.gap ?? 6)
  let legendArea: ChartRect | null = null

  if (legendVisible) {
    const position = legend.position ?? 'top'
    const defaultSize = position === 'top' || position === 'bottom' ? 38 : 128
    const requestedSize = Math.max(1, legend.size ?? defaultSize)
    if (position === 'top') {
      const size = clampReservation(requestedSize, plotArea.height, minPlotHeight, legendGap)
      legendArea = { x: plotArea.x, y: plotArea.y, width: plotArea.width, height: size }
      plotArea = trimTop(plotArea, size + legendGap)
    } else if (position === 'bottom') {
      const size = clampReservation(requestedSize, plotArea.height, minPlotHeight, legendGap)
      legendArea = {
        x: plotArea.x,
        y: plotArea.y + plotArea.height - size,
        width: plotArea.width,
        height: size,
      }
      plotArea.height = Math.max(1, plotArea.height - size - legendGap)
    } else if (position === 'left') {
      const size = clampReservation(requestedSize, plotArea.width, minPlotWidth, legendGap)
      legendArea = { x: plotArea.x, y: plotArea.y, width: size, height: plotArea.height }
      plotArea = trimLeft(plotArea, size + legendGap)
    } else {
      const size = clampReservation(requestedSize, plotArea.width, minPlotWidth, legendGap)
      legendArea = {
        x: plotArea.x + plotArea.width - size,
        y: plotArea.y,
        width: size,
        height: plotArea.height,
      }
      plotArea.width = Math.max(1, plotArea.width - size - legendGap)
    }
  }

  const namedYAxes = options.yAxes?.length ? options.yAxes : undefined
  const namedAxisAreas: (ChartRect | null)[] = []
  let yAxisArea: ChartRect | null = null
  if (namedYAxes) {
    for (let index = namedYAxes.length - 1; index >= 0; index--) {
      const axis = namedYAxes[index]
      if (!axis || axis.visible === false) {
        namedAxisAreas[index] = null
        continue
      }
      const size = clampReservation(Math.max(1, axis.size ?? 56), plotArea.width, minPlotWidth, 0)
      if (size <= 0) {
        namedAxisAreas[index] = null
        continue
      }
      const fromRight = (axis.side ?? (index === 0 ? 'left' : 'right')) === 'right'
      const x = fromRight ? plotArea.x + plotArea.width - size : plotArea.x
      namedAxisAreas[index] = { x, y: plotArea.y, width: size, height: plotArea.height }
      if (fromRight) {
        plotArea.width = Math.max(1, plotArea.width - size)
      } else {
        plotArea = trimLeft(plotArea, size)
      }
    }
  } else if (options.yAxis?.visible === true) {
    const size = clampReservation(
      Math.max(1, options.yAxis.size ?? 56),
      plotArea.width,
      minPlotWidth,
      0,
    )
    yAxisArea = { x: plotArea.x, y: plotArea.y, width: size, height: plotArea.height }
    plotArea = trimLeft(plotArea, size)
  }

  const xAxisVisible = options.xAxis?.visible === true
  const xAxisSize = Math.max(1, options.xAxis?.size ?? 34)
  let xAxisArea: ChartRect | null = null
  if (xAxisVisible) {
    const size = clampReservation(xAxisSize, plotArea.height, minPlotHeight, 0)
    xAxisArea = {
      x: plotArea.x,
      y: plotArea.y + plotArea.height - size,
      width: plotArea.width,
      height: size,
    }
    plotArea.height = Math.max(1, plotArea.height - size)
  }

  const xTickCount = options.grid?.xTickCount ?? options.xAxis?.tickCount ?? 6
  const yTickCount = options.grid?.yTickCount ?? options.yAxis?.tickCount ?? 5
  const yAxes = namedYAxes?.map((axis, index): LaidOutYAxis => {
    const area = namedAxisAreas[index]
    return {
      key: axis.key,
      side: axis.side ?? (index === 0 ? 'left' : 'right'),
      area: area ? { ...area, height: plotArea.height } : null,
      label: axis.label ?? null,
      ticks: buildAxisTicks(
        axis.range ?? options.yRange ?? [0, 1],
        axis.tickCount ?? (index === 0 ? yTickCount : 5),
        plotArea.y + plotArea.height,
        -plotArea.height,
        axis.formatValue,
      ),
    }
  })
  const primaryYAxis = yAxes?.[0]

  return {
    bounds,
    contentArea,
    plotArea,
    overlayArea: legendArea ?? plotArea,
    xAxisArea,
    yAxisArea: primaryYAxis ? primaryYAxis.area : yAxisArea,
    legendArea,
    xAxisLabel: options.xAxis?.label ?? null,
    yAxisLabel: primaryYAxis ? primaryYAxis.label : (options.yAxis?.label ?? null),
    xTicks: buildAxisTicks(
      options.xRange ?? [0, 1],
      xTickCount,
      plotArea.x,
      plotArea.width,
      options.xAxis?.formatValue,
    ),
    yTicks:
      primaryYAxis?.ticks ??
      buildAxisTicks(
        options.yRange ?? [0, 1],
        yTickCount,
        plotArea.y + plotArea.height,
        -plotArea.height,
        options.yAxis?.formatValue,
      ),
    ...(yAxes ? { yAxes } : {}),
  }
}

export function resolveChartLayout(
  layout: ChartLayout | ChartLayoutOptions | undefined,
  width: number,
  height: number,
  xRange: NumericRange,
  yRange: NumericRange,
): ChartLayout | null {
  if (!layout) return null
  if ('plotArea' in layout) return layout
  return createChartLayout({
    ...layout,
    width,
    height,
    xRange: layout.xRange ?? xRange,
    yRange: layout.yRange ?? yRange,
  })
}

export function createPlotViewportTransform(
  xRange: NumericRange,
  yRange: NumericRange,
  canvasWidth: number,
  canvasHeight: number,
  plotArea: ChartRect,
): ViewTransform {
  const [xMin, xMax] = expandRange(xRange, 0)
  const [yMin, yMax] = expandRange(yRange, 0)
  const fullWidth = Math.max(1, canvasWidth)
  const fullHeight = Math.max(1, canvasHeight)
  const plotWidth = Math.max(1, plotArea.width)
  const plotHeight = Math.max(1, plotArea.height)
  const xSpan = Math.max(Number.EPSILON, xMax - xMin)
  const ySpan = Math.max(Number.EPSILON, yMax - yMin)
  const scaleX = plotWidth / xSpan
  const scaleY = -plotHeight / ySpan
  const transform = new ViewTransform(fullWidth, fullHeight)

  transform.setScale(scaleX, scaleY)
  transform.setTranslate(
    (plotArea.x - fullWidth / 2) / scaleX - xMin,
    (plotArea.y + plotHeight - fullHeight / 2) / scaleY - yMin,
  )

  return transform
}

export function addChartGuidesToCommandList(
  commands: RenderCommandList,
  layout: ChartLayout,
  xRange: NumericRange,
  yRange: NumericRange,
  options: ChartGuideOptions = {},
): void {
  const gridVisible = options.gridVisible ?? true
  const axesVisible = options.axesVisible ?? true
  const textVisible = options.textVisible ?? true
  const gridStyle = {
    color: options.gridColor ?? ([0.55, 0.61, 0.7, 0.22] as const),
    width: options.gridLineWidth ?? 1,
  }
  const axisStyle = {
    color: options.axisColor ?? ([0.2, 0.25, 0.33, 0.45] as const),
    width: options.axisLineWidth ?? 1,
  }
  const textStyle = {
    color: options.textColor ?? ([0.2, 0.25, 0.33, 0.78] as const),
    font: options.font ?? 'system-ui, sans-serif',
    fontSize: options.fontSize ?? 11,
  }

  if (gridVisible) {
    for (const tick of layout.xTicks) {
      commands.addLine(
        new Float32Array([tick.value, yRange[0], tick.value, yRange[1]]),
        gridStyle,
        ZLayer.Fill,
      )
    }
    for (const tick of layout.yTicks) {
      commands.addLine(
        new Float32Array([xRange[0], tick.value, xRange[1], tick.value]),
        gridStyle,
        ZLayer.Fill,
      )
    }
  }

  if (axesVisible) {
    commands.addLine(
      new Float32Array([xRange[0], yRange[0], xRange[1], yRange[0]]),
      axisStyle,
      ZLayer.Overlay,
    )
    if (layout.yAxes) {
      if (layout.yAxes.some(({ area, side }) => area && side === 'left')) {
        addYAxisSpine(commands, xRange[0], yRange, axisStyle)
      }
      if (layout.yAxes.some(({ area, side }) => area && side === 'right')) {
        addYAxisSpine(commands, xRange[1], yRange, axisStyle)
      }
    } else {
      addYAxisSpine(commands, xRange[0], yRange, axisStyle)
    }
  }

  if (textVisible) {
    addAxisTextToCommandList(commands, layout, textStyle)
  }
}

function addYAxisSpine(
  commands: RenderCommandList,
  x: number,
  yRange: NumericRange,
  style: { color: RgbaColor; width: number },
): void {
  commands.addLine(new Float32Array([x, yRange[0], x, yRange[1]]), style, ZLayer.Overlay)
}

export function drawCommandList(
  context: RenderContext,
  commands: RenderCommandList,
  defaultTransform?: ViewTransform,
  plotClip?: ChartRect,
): void {
  let currentTransform = defaultTransform
  let clipped = false
  for (const command of commands.sorted()) {
    if (plotClip && context.setClipRect) {
      const clipCommand = command.kind !== 'text'
      if (clipCommand !== clipped) {
        context.setClipRect(clipCommand ? plotClip : null)
        clipped = clipCommand
      }
    }
    if (command.kind !== 'text') {
      const transform = command.transform ?? defaultTransform
      if (transform && transform !== currentTransform) {
        context.setTransform(transform)
        currentTransform = transform
      }
    }
    switch (command.kind) {
      case 'line':
        context.drawLines(command.buffer, command.options)
        break
      case 'fill':
        context.drawFill(command.upper, command.lower, command.options)
        break
      case 'rect':
        context.drawRect(command.x, command.y, command.w, command.h, command.options)
        break
      case 'text':
        context.drawText(command.text, command.x, command.y, command.options)
        break
    }
  }
  if (clipped) context.setClipRect?.(null)
  if (defaultTransform && currentTransform !== defaultTransform)
    context.setTransform(defaultTransform)
}

function resolveInsets(value: number | Partial<EdgeInsets>): EdgeInsets {
  if (typeof value === 'number') {
    const size = Math.max(0, value)
    return { top: size, right: size, bottom: size, left: size }
  }

  return {
    top: Math.max(0, value.top ?? 0),
    right: Math.max(0, value.right ?? 0),
    bottom: Math.max(0, value.bottom ?? 0),
    left: Math.max(0, value.left ?? 0),
  }
}

function insetRect(rect: ChartRect, insets: EdgeInsets): ChartRect {
  return {
    x: rect.x + insets.left,
    y: rect.y + insets.top,
    width: Math.max(1, rect.width - insets.left - insets.right),
    height: Math.max(1, rect.height - insets.top - insets.bottom),
  }
}

function clampReservation(
  size: number,
  available: number,
  minRemainder: number,
  gap: number,
): number {
  return Math.max(1, Math.min(size, Math.max(1, available - minRemainder - gap)))
}

function trimTop(rect: ChartRect, size: number): ChartRect {
  return {
    x: rect.x,
    y: rect.y + size,
    width: rect.width,
    height: Math.max(1, rect.height - size),
  }
}

function trimLeft(rect: ChartRect, size: number): ChartRect {
  return {
    x: rect.x + size,
    y: rect.y,
    width: Math.max(1, rect.width - size),
    height: rect.height,
  }
}

function buildAxisTicks(
  range: NumericRange,
  requestedCount: number,
  startPosition: number,
  positionSpan: number,
  formatValue: ((value: number) => string) | undefined,
): AxisTick[] {
  const [min, max] = normalizeRange(range)
  const count = Math.max(2, Math.min(24, Math.floor(requestedCount)))
  const span = max - min
  const ticks: AxisTick[] = []

  if (!Number.isFinite(span) || span <= 0) {
    return [
      {
        value: min,
        ratio: 0,
        position: startPosition,
        label: formatAxisValue(min, formatValue),
      },
    ]
  }

  for (let i = 0; i < count; i++) {
    const ratio = count === 1 ? 0 : i / (count - 1)
    const value = min + span * ratio
    ticks.push({
      value,
      ratio,
      position: startPosition + positionSpan * ratio,
      label: formatAxisValue(value, formatValue),
    })
  }

  return ticks
}

function addAxisTextToCommandList(
  commands: RenderCommandList,
  layout: ChartLayout,
  style: {
    color: RgbaColor
    font: string
    fontSize: number
  },
): void {
  if (layout.xAxisArea) {
    const tickY = layout.xAxisArea.y + 6
    for (const tick of layout.xTicks) {
      commands.addText(
        tick.label,
        tick.position,
        tickY,
        {
          ...style,
          align: 'center',
          baseline: 'top',
        },
        ZLayer.Text,
      )
    }

    if (layout.xAxisLabel) {
      commands.addText(
        layout.xAxisLabel,
        layout.xAxisArea.x + layout.xAxisArea.width / 2,
        layout.xAxisArea.y + layout.xAxisArea.height - 2,
        {
          ...style,
          align: 'center',
          baseline: 'bottom',
        },
        ZLayer.Text,
      )
    }
  }

  const yAxes = layout.yAxes ?? [
    { side: 'left', area: layout.yAxisArea, ticks: layout.yTicks, label: layout.yAxisLabel },
  ]
  for (const { area, side, ticks, label } of yAxes) {
    if (!area) continue
    const fromRight = side === 'right'
    const tickX = fromRight ? area.x + 6 : area.x + area.width - 6
    for (const tick of ticks) {
      commands.addText(
        tick.label,
        tickX,
        tick.position,
        {
          ...style,
          align: fromRight ? 'left' : 'right',
          baseline: 'middle',
        },
        ZLayer.Text,
      )
    }

    if (label) {
      commands.addText(
        label,
        fromRight ? area.x + area.width - 6 : area.x + 6,
        area.y + 4,
        {
          ...style,
          align: fromRight ? 'right' : 'left',
          baseline: 'top',
        },
        ZLayer.Text,
      )
    }
  }
}

function formatAxisValue(value: number, formatValue: ((value: number) => string) | undefined) {
  if (formatValue) return formatValue(value)
  if (!Number.isFinite(value)) return ''
  const abs = Math.abs(value)
  if (abs === 0) return '0'
  if (abs >= 1_000_000 || abs < 0.001) return value.toExponential(2)
  if (abs >= 100) return value.toFixed(0)
  if (abs >= 10) return value.toFixed(1)
  return value.toFixed(2)
}
