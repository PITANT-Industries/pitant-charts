import type { ChartLayout, ChartRect, NumericRange } from './common.js'
import { normalizeRange } from './common.js'

export interface ChartClientPoint {
  clientX: number
  clientY: number
}

export interface ChartPointerViewport {
  left: number
  top: number
  width: number
  height: number
}

export interface ChartPoint {
  x: number
  y: number
}

export interface ChartDataPoint {
  x: number
  y: number
  relativeX: number
}

export interface ChartPointerMappingOptions {
  clampToPlot?: boolean
  xValueOffset?: number
}

export interface MapPointerToChartCoordinatesInput
  extends ChartClientPoint,
    ChartPointerMappingOptions {
  viewport: ChartPointerViewport
  layout: ChartLayout
  xRange: NumericRange
  yRange: NumericRange
}

export interface MapChartPointToDataInput extends ChartPoint, ChartPointerMappingOptions {
  layout: ChartLayout
  xRange: NumericRange
  yRange: NumericRange
}

export interface MapDataPointToChartInput extends ChartPointerMappingOptions {
  x: number
  y: number
  relativeX?: number
  layout: ChartLayout
  xRange: NumericRange
  yRange: NumericRange
}

export interface ChartPointerCoordinates {
  clientX: number
  clientY: number
  chartX: number
  chartY: number
  plotX: number
  plotY: number
  plotRatioX: number
  plotRatioY: number
  dataX: number
  dataY: number
  relativeDataX: number
  insideBounds: boolean
  insidePlot: boolean
}

export function mapPointerToChartCoordinates(
  input: MapPointerToChartCoordinatesInput,
): ChartPointerCoordinates {
  const chartPoint = clientPointToChartPoint(input)
  const chartPointInput: MapChartPointToDataInput = {
    x: chartPoint.x,
    y: chartPoint.y,
    layout: input.layout,
    xRange: input.xRange,
    yRange: input.yRange,
  }
  if (input.clampToPlot !== undefined) chartPointInput.clampToPlot = input.clampToPlot
  if (input.xValueOffset !== undefined) chartPointInput.xValueOffset = input.xValueOffset
  const dataPoint = mapChartPointToDataPoint(chartPointInput)
  const plotPoint = chartPointToPlotPoint(input.layout.plotArea, chartPoint, input.clampToPlot)

  return {
    clientX: input.clientX,
    clientY: input.clientY,
    chartX: chartPoint.x,
    chartY: chartPoint.y,
    plotX: plotPoint.x,
    plotY: plotPoint.y,
    plotRatioX: plotPoint.ratioX,
    plotRatioY: plotPoint.ratioY,
    dataX: dataPoint.x,
    dataY: dataPoint.y,
    relativeDataX: dataPoint.relativeX,
    insideBounds: rectContainsPoint(input.layout.bounds, chartPoint),
    insidePlot: rectContainsPoint(input.layout.plotArea, chartPoint),
  }
}

export function clientPointToChartPoint(input: {
  clientX: number
  clientY: number
  viewport: ChartPointerViewport
  layout: ChartLayout
}): ChartPoint {
  const viewportWidth = Math.max(Number.EPSILON, input.viewport.width)
  const viewportHeight = Math.max(Number.EPSILON, input.viewport.height)
  const scaleX = input.layout.bounds.width / viewportWidth
  const scaleY = input.layout.bounds.height / viewportHeight

  return {
    x: input.layout.bounds.x + (input.clientX - input.viewport.left) * scaleX,
    y: input.layout.bounds.y + (input.clientY - input.viewport.top) * scaleY,
  }
}

export function mapChartPointToDataPoint(input: MapChartPointToDataInput): ChartDataPoint {
  const plotPoint = chartPointToPlotPoint(
    input.layout.plotArea,
    { x: input.x, y: input.y },
    input.clampToPlot,
  )
  const [xMin, xMax] = normalizeRange(input.xRange)
  const [yMin, yMax] = normalizeRange(input.yRange)
  const relativeX = interpolateRange(xMin, xMax, plotPoint.ratioX)
  const dataY = interpolateRange(yMax, yMin, plotPoint.ratioY)

  return {
    x: relativeX + (input.xValueOffset ?? 0),
    y: dataY,
    relativeX,
  }
}

export function mapDataPointToChartPoint(input: MapDataPointToChartInput): ChartPoint {
  const [xMin, xMax] = normalizeRange(input.xRange)
  const [yMin, yMax] = normalizeRange(input.yRange)
  const relativeX = input.relativeX ?? input.x - (input.xValueOffset ?? 0)
  const ratioX = rangeRatio(xMin, xMax, relativeX)
  const ratioY = rangeRatio(yMax, yMin, input.y)
  const plotRatioX = input.clampToPlot === true ? clamp01(ratioX) : ratioX
  const plotRatioY = input.clampToPlot === true ? clamp01(ratioY) : ratioY

  return {
    x: input.layout.plotArea.x + plotRatioX * input.layout.plotArea.width,
    y: input.layout.plotArea.y + plotRatioY * input.layout.plotArea.height,
  }
}

function chartPointToPlotPoint(
  plotArea: ChartRect,
  point: ChartPoint,
  clampToPlot: boolean | undefined,
): { x: number; y: number; ratioX: number; ratioY: number } {
  const rawX = point.x - plotArea.x
  const rawY = point.y - plotArea.y
  const x = clampToPlot === true ? clamp(rawX, 0, plotArea.width) : rawX
  const y = clampToPlot === true ? clamp(rawY, 0, plotArea.height) : rawY

  return {
    x,
    y,
    ratioX: x / Math.max(Number.EPSILON, plotArea.width),
    ratioY: y / Math.max(Number.EPSILON, plotArea.height),
  }
}

function rectContainsPoint(rect: ChartRect, point: ChartPoint): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x <= rect.x + rect.width &&
    point.y <= rect.y + rect.height
  )
}

function interpolateRange(min: number, max: number, ratio: number): number {
  return min + (max - min) * ratio
}

function rangeRatio(min: number, max: number, value: number): number {
  const span = max - min
  if (Math.abs(span) <= Number.EPSILON) return 0.5
  return (value - min) / span
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
