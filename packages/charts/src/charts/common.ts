import { type RenderCommandList, ZLayer } from '../renderer/render-command-list.js'
import type {
  FillOptions,
  LineOptions,
  MarkBatchOptions,
  RenderContext,
} from '../renderer/types.js'
import { ViewTransform } from '../renderer/view-transform.js'
import {
  type AxisProjection,
  type CalendarAxisOptions,
  type ChartScale,
  calendarTicks,
  createAxisProjection,
  logarithmicTicks,
} from './axis-scale.js'

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

export interface AxisRangePolicy {
  softMin?: number
  softMax?: number
  hardMin?: number
  hardMax?: number
  apply?: (range: NumericRange) => NumericRange
}

export interface AxisLayoutOptions {
  visible?: boolean
  size?: number | 'auto'
  tickCount?: number
  /** Tick label rotation in degrees. */
  tickRotation?: number
  side?: 'left' | 'right' | 'top' | 'bottom'
  label?: string
  textColor?: RgbaColor
  /** Grid lines follow this axis's ticks. A secondary axis must opt in. */
  grid?: boolean | Partial<Pick<LineOptions, 'color' | 'width' | 'dash'>>
  formatValue?: (value: number) => string
  scale?: ChartScale
  rangePolicy?: AxisRangePolicy
  /** Minimum spacing between automatically generated ticks, in CSS pixels. */
  tickSpacing?: number
  calendar?: CalendarAxisOptions
  /** Restores the original values of a rebased data axis for ticks and scale math. */
  valueOffset?: number
  /** Explicit original data values, or a generator that receives original bounds. */
  tickValues?: readonly number[] | ((range: NumericRange, targetCount: number) => readonly number[])
}

/** Bidirectional unit conversion to an earlier named axis. */
export interface DependentYAxis {
  key: string
  fromSource(value: number): number
  toSource(value: number): number
}

export interface NamedYAxisLayoutOptions extends AxisLayoutOptions {
  key: string
  side?: 'left' | 'right'
  range?: NumericRange
  from?: DependentYAxis
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
  /** Rotate the Cartesian layout so X runs downward and Y runs to the right. */
  orientation?: 'rotated'
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
  projection?: AxisProjection
  range?: NumericRange
  tickRotation?: number
  textColor?: AxisLayoutOptions['textColor']
  grid?: AxisLayoutOptions['grid']
}

export interface ChartLayout {
  bounds: ChartRect
  contentArea: ChartRect
  plotArea: ChartRect
  orientation?: 'rotated'
  overlayArea: ChartRect
  xAxisArea: ChartRect | null
  yAxisArea: ChartRect | null
  xAxisSide?: 'top'
  yAxisSide?: 'right'
  xTickRotation?: number
  yTickRotation?: number
  xTextColor?: AxisLayoutOptions['textColor']
  yTextColor?: AxisLayoutOptions['textColor']
  xGrid?: AxisLayoutOptions['grid']
  yGrid?: AxisLayoutOptions['grid']
  legendArea: ChartRect | null
  xAxisLabel: string | null
  yAxisLabel: string | null
  xTicks: readonly AxisTick[]
  yTicks: readonly AxisTick[]
  yAxes?: readonly LaidOutYAxis[]
  xProjection?: AxisProjection
  yProjection?: AxisProjection
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
  if (options.orientation === 'rotated') return createRotatedChartLayout(options)
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

  const xAtTop = options.xAxis?.side === 'top'
  const yAtRight = options.yAxis?.side === 'right'
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
      const size = clampReservation(
        axisSize(axis, axis.range ?? options.yRange ?? [0, 1], 56, false),
        plotArea.width,
        minPlotWidth,
        0,
      )
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
      axisSize(options.yAxis, options.yRange ?? [0, 1], 56, false),
      plotArea.width,
      minPlotWidth,
      0,
    )
    yAxisArea = {
      x: yAtRight ? plotArea.x + plotArea.width - size : plotArea.x,
      y: plotArea.y,
      width: size,
      height: plotArea.height,
    }
    if (yAtRight) plotArea.width = Math.max(1, plotArea.width - size)
    else plotArea = trimLeft(plotArea, size)
  }

  const xAxisVisible = options.xAxis?.visible === true
  const xAxisSize = axisSize(options.xAxis, options.xRange ?? [0, 1], 34, true)
  let xAxisArea: ChartRect | null = null
  if (xAxisVisible) {
    const size = clampReservation(xAxisSize, plotArea.height, minPlotHeight, 0)
    xAxisArea = {
      x: plotArea.x,
      y: xAtTop ? plotArea.y : plotArea.y + plotArea.height - size,
      width: plotArea.width,
      height: size,
    }
    if (xAtTop) plotArea = trimTop(plotArea, size)
    else plotArea.height = Math.max(1, plotArea.height - size)
  }

  const xTickCount = options.xAxis?.tickCount ?? options.grid?.xTickCount ?? 6
  const yTickCount = options.yAxis?.tickCount ?? options.grid?.yTickCount ?? 5
  const xRange = axisDomain(options.xRange ?? [0, 1], options.xAxis)
  const yRange = axisDomain(options.yRange ?? [0, 1], options.yAxis)
  const xProjection = axisProjection(xRange, options.xAxis)
  const yAxes: LaidOutYAxis[] = []
  for (const [index, axis] of (namedYAxes ?? []).entries()) {
    const area = namedAxisAreas[index]
    const source = axis.from ? yAxes.find((entry) => entry.key === axis.from?.key) : undefined
    const sourceRange = source?.range
    const conversion = axis.from
    const range =
      conversion && sourceRange
        ? normalizeRange([
            conversion.fromSource(sourceRange[0]),
            conversion.fromSource(sourceRange[1]),
          ])
        : axisDomain(axis.range ?? yRange, axis)
    const projection =
      conversion && source && sourceRange
        ? dependentAxisProjection(
            source.projection ??
              createAxisProjection({ type: 'linear' }, expandRange(sourceRange, 0)),
            conversion,
          )
        : axisProjection(range, axis)
    const tickOptions =
      conversion && source && axis.tickValues === undefined
        ? { ...axis, tickValues: source.ticks.map(({ value }) => conversion.fromSource(value)) }
        : axis
    yAxes.push({
      key: axis.key,
      range,
      side: axis.side ?? (index === 0 ? 'left' : 'right'),
      area: area ? { ...area, y: plotArea.y, height: plotArea.height } : null,
      label: axis.label ?? null,
      ...(axis.tickRotation ? { tickRotation: axis.tickRotation } : {}),
      ...(axis.textColor ? { textColor: axis.textColor } : {}),
      ...(axis.grid === undefined ? {} : { grid: axis.grid }),
      ticks: buildAxisTicks(
        range,
        axis.tickCount ?? (index === 0 ? yTickCount : 5),
        plotArea.y + plotArea.height,
        -plotArea.height,
        tickOptions,
        projection,
      ),
      ...(projection ? { projection } : {}),
    })
  }
  const primaryYAxis = yAxes[0]
  const yProjection = primaryYAxis ? primaryYAxis.projection : axisProjection(yRange, options.yAxis)

  return {
    bounds,
    contentArea,
    plotArea,
    overlayArea: legendArea ?? plotArea,
    xAxisArea,
    yAxisArea: primaryYAxis ? primaryYAxis.area : yAxisArea,
    ...(xAtTop ? { xAxisSide: 'top' as const } : {}),
    ...(yAtRight ? { yAxisSide: 'right' as const } : {}),
    ...(options.xAxis?.tickRotation ? { xTickRotation: options.xAxis.tickRotation } : {}),
    ...(options.yAxis?.tickRotation ? { yTickRotation: options.yAxis.tickRotation } : {}),
    ...(options.xAxis?.textColor ? { xTextColor: options.xAxis.textColor } : {}),
    ...(options.yAxis?.textColor ? { yTextColor: options.yAxis.textColor } : {}),
    ...(options.xAxis?.grid === undefined ? {} : { xGrid: options.xAxis.grid }),
    ...(options.yAxis?.grid === undefined ? {} : { yGrid: options.yAxis.grid }),
    legendArea,
    xAxisLabel: options.xAxis?.label ?? null,
    yAxisLabel: primaryYAxis ? primaryYAxis.label : (options.yAxis?.label ?? null),
    xTicks: buildAxisTicks(
      xRange,
      xTickCount,
      plotArea.x,
      plotArea.width,
      options.xAxis,
      xProjection,
    ),
    yTicks:
      primaryYAxis?.ticks ??
      buildAxisTicks(
        yRange,
        yTickCount,
        plotArea.y + plotArea.height,
        -plotArea.height,
        options.yAxis,
        yProjection,
      ),
    ...(namedYAxes ? { yAxes } : {}),
    ...(xProjection ? { xProjection } : {}),
    ...(yProjection ? { yProjection } : {}),
  }
}

const ROTATED_LEGEND_POSITION: Record<LegendPosition, LegendPosition> = {
  top: 'left',
  right: 'top',
  bottom: 'right',
  left: 'bottom',
}

function createRotatedChartLayout(options: ChartLayoutOptions): ChartLayout {
  const {
    orientation,
    padding,
    legend,
    xAxis,
    minPlotWidth,
    minPlotHeight,
    width,
    height,
    ...layoutOptions
  } = options
  const insets = resolveInsets(padding ?? 8)
  const layout = createChartLayout({
    ...layoutOptions,
    width: height,
    height: width,
    ...(xAxis && {
      xAxis: { ...xAxis, size: axisSize(xAxis, options.xRange ?? [0, 1], 56, false) },
    }),
    padding: { top: insets.right, right: insets.bottom, bottom: insets.left, left: insets.top },
    minPlotHeight: minPlotWidth ?? 64,
    minPlotWidth: minPlotHeight ?? 48,
    ...(legend
      ? {
          legend: {
            ...legend,
            size:
              legend.size ??
              ((legend.position ?? 'top') === 'top' || legend.position === 'bottom' ? 38 : 128),
            position: ROTATED_LEGEND_POSITION[legend.position ?? 'top'],
          },
        }
      : {}),
  })
  const viewportWidth = layout.bounds.height
  const rotate = ({ x, y, width: w, height: h }: ChartRect): ChartRect => ({
    x: viewportWidth - y - h,
    y: x,
    width: h,
    height: w,
  })
  const rotateArea = (rect: ChartRect | null) => (rect ? rotate(rect) : null)
  const rotateTicks = (ticks: readonly AxisTick[]) =>
    ticks.map((tick) => ({ ...tick, position: viewportWidth - tick.position }))
  return {
    ...layout,
    orientation: orientation ?? 'rotated',
    bounds: rotate(layout.bounds),
    contentArea: rotate(layout.contentArea),
    plotArea: rotate(layout.plotArea),
    overlayArea: rotate(layout.overlayArea),
    xAxisArea: rotateArea(layout.xAxisArea),
    yAxisArea: rotateArea(layout.yAxisArea),
    legendArea: rotateArea(layout.legendArea),
    yTicks: rotateTicks(layout.yTicks),
    ...(layout.yAxes
      ? {
          yAxes: layout.yAxes.map((axis) => ({
            ...axis,
            area: rotateArea(axis.area),
            ticks: rotateTicks(axis.ticks),
          })),
        }
      : {}),
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
  projections?: Pick<ChartLayout, 'orientation' | 'xProjection' | 'yProjection'>,
): ViewTransform {
  const [xMin, xMax] = projections?.xProjection ? [0, 1] : expandRange(xRange, 0)
  const [yMin, yMax] = projections?.yProjection ? [0, 1] : expandRange(yRange, 0)
  const rotated = projections?.orientation === 'rotated'
  const width = Math.max(1, canvasWidth)
  const height = Math.max(1, canvasHeight)
  const fullWidth = rotated ? height : width
  const fullHeight = rotated ? width : height
  const plotWidth = Math.max(1, rotated ? plotArea.height : plotArea.width)
  const plotHeight = Math.max(1, rotated ? plotArea.width : plotArea.height)
  const plotX = rotated ? plotArea.y : plotArea.x
  const plotY = rotated ? width - plotArea.x - plotArea.width : plotArea.y
  const xSpan = Math.max(Number.EPSILON, xMax - xMin)
  const ySpan = Math.max(Number.EPSILON, yMax - yMin)
  const scaleX = plotWidth / xSpan
  const scaleY = -plotHeight / ySpan
  const transform = new ViewTransform(width, height)

  transform.setRotated(rotated)
  transform.setProjections(projections?.xProjection, projections?.yProjection)
  transform.setScale(scaleX, scaleY)
  transform.setTranslate(
    (plotX - fullWidth / 2) / scaleX - xMin,
    (plotY + plotHeight - fullHeight / 2) / scaleY - yMin,
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

  const xmin = layout.xProjection?.fromRatio(0) ?? xRange[0]
  const xmax = layout.xProjection?.fromRatio(1) ?? xRange[1]
  const ymin = layout.yProjection?.fromRatio(0) ?? yRange[0]
  const ymax = layout.yProjection?.fromRatio(1) ?? yRange[1]

  if (gridVisible) {
    if (layout.xGrid !== false) {
      const style = mergeGridStyle(gridStyle, layout.xGrid)
      for (const tick of layout.xTicks) {
        commands.addLine(new Float32Array([tick.value, ymin, tick.value, ymax]), style, ZLayer.Fill)
      }
    }
    const primaryGrid = layout.yAxes?.[0]?.grid ?? layout.yGrid
    if (primaryGrid !== false) {
      const style = mergeGridStyle(gridStyle, primaryGrid)
      for (const tick of layout.yTicks) {
        commands.addLine(new Float32Array([xmin, tick.value, xmax, tick.value]), style, ZLayer.Fill)
      }
    }
    addSecondaryGrids(commands, layout, gridStyle)
  }

  if (axesVisible) {
    const horizontal = layout.xAxisSide === 'top' ? ymax : ymin
    const vertical: NumericRange = [ymin, ymax]
    commands.addLine(
      new Float32Array([xmin, horizontal, xmax, horizontal]),
      axisStyle,
      ZLayer.Overlay,
    )
    if (layout.yAxes) {
      if (layout.yAxes.some(({ area, side }) => area && side === 'left')) {
        addYAxisSpine(commands, xmin, vertical, axisStyle)
      }
      if (layout.yAxes.some(({ area, side }) => area && side === 'right')) {
        addYAxisSpine(commands, xmax, vertical, axisStyle)
      }
    } else {
      addYAxisSpine(commands, layout.yAxisSide === 'right' ? xmax : xmin, vertical, axisStyle)
    }
  }

  if (textVisible) {
    addAxisTextToCommandList(commands, layout, textStyle)
  }
}

function mergeGridStyle(defaults: LineOptions, grid: AxisLayoutOptions['grid']): LineOptions {
  return typeof grid === 'object' ? { ...defaults, ...grid } : defaults
}

function addSecondaryGrids(
  commands: RenderCommandList,
  layout: ChartLayout,
  defaults: LineOptions,
): void {
  const axes = layout.yAxes
  if (!axes || axes.length < 2) return
  const { x, width } = layout.plotArea
  const { y, height } = layout.plotArea
  let pixels: ViewTransform | undefined
  for (let index = 1; index < axes.length; index++) {
    const axis = axes[index]
    if (!axis?.grid) continue
    if (!pixels) {
      const { width, height } = layout.bounds
      pixels = new ViewTransform(width, height)
      pixels.setTranslate(-width / 2, -height / 2)
    }
    const style = mergeGridStyle(defaults, axis.grid)
    for (const tick of axis.ticks) {
      const position = tick.position
      const points =
        layout.orientation === 'rotated'
          ? [position, y, position, y + height]
          : [x, position, x + width, position]
      commands.addLine(new Float32Array(points), style, ZLayer.Fill, pixels)
    }
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
    const projection = currentTransform?.hasProjection ? currentTransform : undefined
    switch (command.kind) {
      case 'line':
        if (projection) drawProjectedLine(context, projection, command.buffer, command.options)
        else context.drawLines(command.buffer, command.options)
        break
      case 'fill':
        if (projection)
          drawProjectedFill(context, projection, command.upper, command.lower, command.options)
        else context.drawFill(command.upper, command.lower, command.options)
        break
      case 'rect':
        if (projection) {
          const x = projection.mapX(command.x)
          const y = projection.mapY(command.y)
          const right = projection.mapX(command.x + command.w)
          const bottom = projection.mapY(command.y + command.h)
          if (
            Number.isFinite(x) &&
            Number.isFinite(y) &&
            Number.isFinite(right) &&
            Number.isFinite(bottom)
          ) {
            context.drawRect(
              Math.min(x, right),
              Math.min(y, bottom),
              Math.abs(right - x),
              Math.abs(bottom - y),
              command.options,
            )
          }
        } else {
          context.drawRect(command.x, command.y, command.w, command.h, command.options)
        }
        break
      case 'marks':
        drawMarks(context, command.bounds, command.options, projection)
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

function drawMarks(
  context: RenderContext,
  bounds: Float32Array,
  options: MarkBatchOptions,
  projection: ViewTransform | undefined,
): void {
  if (context.drawMarks && !projection) {
    context.drawMarks(bounds, options)
    return
  }
  const projected = new Float32Array(bounds.length)
  let size = 0
  for (let index = 0; index < bounds.length; index += 4) {
    const x = bounds[index] as number
    const y = bounds[index + 1] as number
    const w = bounds[index + 2] as number
    const h = bounds[index + 3] as number
    const left = projection?.mapX(x) ?? x
    const right = projection?.mapX(x + w) ?? x + w
    const top = projection?.mapY(y) ?? y
    const bottom = projection?.mapY(y + h) ?? y + h
    if (
      !Number.isFinite(left) ||
      !Number.isFinite(right) ||
      !Number.isFinite(top) ||
      !Number.isFinite(bottom)
    )
      continue
    if (context.drawMarks) {
      projected.set(
        [
          Math.min(left, right),
          Math.min(top, bottom),
          Math.abs(right - left),
          Math.abs(bottom - top),
        ],
        size,
      )
      size += 4
    } else {
      context.drawRect(
        Math.min(left, right),
        Math.min(top, bottom),
        Math.abs(right - left),
        Math.abs(bottom - top),
        { fillColor: options.color },
      )
    }
  }
  if (size > 0) context.drawMarks?.(projected.subarray(0, size), options)
}

function projectPairs(raw: Float32Array, transform: ViewTransform): Float32Array {
  const projected = new Float32Array(raw.length)
  for (let index = 0; index < raw.length; index += 2) {
    projected[index] = transform.mapX(raw[index] as number)
    projected[index + 1] = transform.mapY(raw[index + 1] as number)
  }
  return projected
}

function finitePair(values: Float32Array, index: number): boolean {
  return Number.isFinite(values[index]) && Number.isFinite(values[index + 1])
}

function drawProjectedLine(
  context: RenderContext,
  transform: ViewTransform,
  buffer: Float32Array,
  options: LineOptions,
): void {
  const values = projectPairs(buffer, transform)
  let start = 0
  for (let index = 0; index <= values.length; index += 2) {
    if (index < values.length && finitePair(values, index)) continue
    if (index - start >= 4) context.drawLines(values.subarray(start, index), options)
    start = index + 2
  }
}

function drawProjectedFill(
  context: RenderContext,
  transform: ViewTransform,
  upper: Float32Array,
  lower: Float32Array,
  options: FillOptions,
): void {
  const top = projectPairs(upper, transform)
  const bottom = projectPairs(lower, transform)
  if (top.length !== bottom.length) {
    if (top.every(Number.isFinite) && bottom.every(Number.isFinite))
      context.drawFill(top, bottom, options)
    return
  }
  let start = 0
  for (let index = 0; index <= top.length; index += 2) {
    if (index < top.length && finitePair(top, index) && finitePair(bottom, index)) continue
    if (index - start >= 4)
      context.drawFill(top.subarray(start, index), bottom.subarray(start, index), options)
    start = index + 2
  }
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

function axisSize(
  axis: AxisLayoutOptions | undefined,
  range: NumericRange,
  fallback: number,
  horizontal: boolean,
): number {
  if (axis?.size !== 'auto') return Math.max(1, axis?.size ?? fallback)
  const offset = axis.valueOffset ?? 0
  const [min, max] = range
  const time = axis.calendar
    ? calendarTicks([min + offset, max + offset], 4, axis.calendar)
    : undefined
  const labelLength = [min, (min + max) / 2, max].reduce(
    (longest, value) =>
      Math.max(longest, formatAxisValue(value + offset, axis.formatValue ?? time?.format).length),
    0,
  )
  const angle = ((axis.tickRotation ?? 0) * Math.PI) / 180
  const contribution = horizontal ? Math.abs(Math.sin(angle)) : Math.abs(Math.cos(angle))
  return Math.ceil(Math.max(fallback, labelLength * 7 * contribution + (axis.label ? 25 : 14)))
}

function dependentAxisProjection(
  source: AxisProjection,
  conversion: DependentYAxis,
): AxisProjection {
  return {
    toRatio: (value) => source.toRatio(conversion.toSource(value)),
    fromRatio: (ratio) => conversion.fromSource(source.fromRatio(ratio)),
  }
}

function axisDomain(range: NumericRange, options?: AxisLayoutOptions): NumericRange {
  const domain = normalizeRange(range)
  const policy = options?.rangePolicy
  const offset = options?.valueOffset ?? 0
  let lo = domain[0] + offset
  let hi = domain[1] + offset
  if (policy) {
    lo = Math.min(lo, policy.softMin ?? lo)
    hi = Math.max(hi, policy.softMax ?? hi)
    if (policy.apply) [lo, hi] = normalizeRange(policy.apply([lo, hi]))
    lo = Math.max(lo, policy.hardMin ?? lo)
    hi = Math.min(hi, policy.hardMax ?? hi)
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
      lo = domain[0] + offset
      hi = domain[1] + offset
    }
  }
  if (options?.scale?.type === 'log') {
    const base = options.scale.base ?? 10
    if (hi <= 0) return [1 - offset, base - offset]
    if (lo <= 0) lo = Math.max(Number.MIN_VALUE, hi / base ** 3)
    else if (lo === hi) return [lo / base - offset, hi * base - offset]
  }
  return [lo - offset, hi - offset]
}

function axisProjection(
  range: NumericRange,
  options?: AxisLayoutOptions,
): AxisProjection | undefined {
  const scale = options?.scale ?? (options?.rangePolicy ? { type: 'linear' as const } : undefined)
  if (!scale) return undefined
  return createAxisProjection(scale, expandRange(range, 0), options?.valueOffset)
}

function buildAxisTicks(
  range: NumericRange,
  requestedCount: number,
  startPosition: number,
  positionSpan: number,
  options?: AxisLayoutOptions,
  projection?: AxisProjection,
): AxisTick[] {
  const [min, max] = normalizeRange(range)
  const spacing = options?.tickSpacing
  const budget = spacing && spacing > 0 ? Math.floor(Math.abs(positionSpan) / spacing) + 1 : 24
  const count = Math.max(2, Math.min(24, budget, Math.floor(requestedCount)))
  const span = max - min
  const offset = options?.valueOffset ?? 0
  const valueRange: NumericRange = [min + offset, max + offset]
  const time = options?.calendar ? calendarTicks(valueRange, count, options.calendar) : undefined
  const explicit =
    typeof options?.tickValues === 'function'
      ? options.tickValues(valueRange, count)
      : options?.tickValues
  const ticks =
    explicit ??
    time?.values ??
    (options?.scale?.type === 'log'
      ? logarithmicTicks(valueRange, count, options.scale.base ?? 10)
      : options?.scale?.type === 'ordinal'
        ? options.scale.values
        : undefined)
  const format = options?.formatValue ?? time?.format
  if (ticks) {
    const result: AxisTick[] = []
    const seen = new Set<number>()
    for (const original of ticks) {
      const value = original - offset
      if (!Number.isFinite(value) || value < min || value > max || seen.has(value)) continue
      seen.add(value)
      const ratio = projection?.toRatio(value) ?? (span > 0 ? (value - min) / span : 0)
      if (!Number.isFinite(ratio)) continue
      result.push({
        value,
        ratio,
        position: startPosition + positionSpan * ratio,
        label: formatAxisValue(original, format),
      })
    }
    if (result.length) return result
  }

  if (!Number.isFinite(span) || span <= 0) {
    return [
      {
        value: min,
        ratio: 0,
        position: startPosition,
        label: formatAxisValue(min + offset, format),
      },
    ]
  }

  return Array.from({ length: count }, (_, index): AxisTick => {
    const ratio = index / (count - 1)
    const value = projection?.fromRatio(ratio) ?? min + span * ratio
    return {
      value,
      ratio,
      position: startPosition + positionSpan * ratio,
      label: formatAxisValue(value + offset, format),
    }
  })
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
  if (layout.orientation === 'rotated') {
    addRotatedAxisText(commands, layout, style)
    return
  }
  if (layout.xAxisArea) {
    const atTop = layout.xAxisSide === 'top'
    const textColor = layout.xTextColor ?? style.color
    const tickY = atTop ? layout.xAxisArea.y + layout.xAxisArea.height - 6 : layout.xAxisArea.y + 6
    for (const tick of layout.xTicks) {
      commands.addText(
        tick.label,
        tick.position,
        tickY,
        {
          ...style,
          color: textColor,
          align: 'center',
          baseline: atTop ? 'bottom' : 'top',
          ...(layout.xTickRotation ? { rotation: layout.xTickRotation } : {}),
        },
        ZLayer.Text,
      )
    }

    if (layout.xAxisLabel) {
      commands.addText(
        layout.xAxisLabel,
        layout.xAxisArea.x + layout.xAxisArea.width / 2,
        atTop ? layout.xAxisArea.y + 2 : layout.xAxisArea.y + layout.xAxisArea.height - 2,
        {
          ...style,
          color: textColor,
          align: 'center',
          baseline: atTop ? 'top' : 'bottom',
        },
        ZLayer.Text,
      )
    }
  }

  const yAxes = layout.yAxes ?? [
    {
      side: layout.yAxisSide ?? 'left',
      area: layout.yAxisArea,
      ticks: layout.yTicks,
      label: layout.yAxisLabel,
      tickRotation: layout.yTickRotation,
      textColor: layout.yTextColor,
    },
  ]
  for (const { area, side, ticks, label, tickRotation, textColor } of yAxes) {
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
          color: textColor ?? style.color,
          align: fromRight ? 'left' : 'right',
          baseline: 'middle',
          ...(tickRotation ? { rotation: tickRotation } : {}),
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
          color: textColor ?? style.color,
          align: fromRight ? 'right' : 'left',
          baseline: 'top',
        },
        ZLayer.Text,
      )
    }
  }
}

function addRotatedAxisText(
  commands: RenderCommandList,
  layout: ChartLayout,
  style: { color: RgbaColor; font: string; fontSize: number },
): void {
  const xAxis = layout.xAxisArea
  if (xAxis) {
    const right = layout.xAxisSide === 'top'
    const x = right ? xAxis.x + 6 : xAxis.x + xAxis.width - 6
    const color = layout.xTextColor ?? style.color
    for (const tick of layout.xTicks) {
      commands.addText(tick.label, x, tick.position, {
        ...style,
        color,
        align: right ? 'left' : 'right',
        baseline: 'middle',
        ...(layout.xTickRotation ? { rotation: layout.xTickRotation } : {}),
      })
    }
    if (layout.xAxisLabel) {
      commands.addText(layout.xAxisLabel, xAxis.x + xAxis.width / 2, xAxis.y + xAxis.height / 2, {
        ...style,
        color,
        align: 'center',
        baseline: right ? 'bottom' : 'top',
        rotation: -90,
      })
    }
  }
  const yAxes = layout.yAxes ?? [
    {
      side: layout.yAxisSide ?? 'left',
      area: layout.yAxisArea,
      ticks: layout.yTicks,
      label: layout.yAxisLabel,
      tickRotation: layout.yTickRotation,
      textColor: layout.yTextColor,
    },
  ]
  for (const { side, area, ticks, label, tickRotation, textColor } of yAxes) {
    if (!area) continue
    const bottom = side === 'right'
    const color = textColor ?? style.color
    const y = bottom ? area.y + 6 : area.y + area.height - 6
    for (const tick of ticks) {
      commands.addText(tick.label, tick.position, y, {
        ...style,
        color,
        align: 'center',
        baseline: bottom ? 'top' : 'bottom',
        ...(tickRotation ? { rotation: tickRotation } : {}),
      })
    }
    if (label) {
      commands.addText(
        label,
        area.x + area.width / 2,
        bottom ? area.y + area.height - 2 : area.y + 2,
        {
          ...style,
          color,
          align: 'center',
          baseline: bottom ? 'bottom' : 'top',
        },
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
