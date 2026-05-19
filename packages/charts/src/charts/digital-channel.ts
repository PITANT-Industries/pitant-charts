import { RenderCommandList, ZLayer } from '../renderer/render-command-list.js'
import type { LineOptions, RenderContext } from '../renderer/types.js'
import type { ViewTransform } from '../renderer/view-transform.js'
import {
  addChartGuidesToCommandList,
  type ChartGuideOptions,
  type ChartLayout,
  type ChartLayoutOptions,
  createPlotViewportTransform,
  createViewportTransform,
  drawCommandList,
  finiteRange,
  getDefaultColor,
  isFiniteNumber,
  type NumericRange,
  normalizeRange,
  type RgbaColor,
  relativeRange,
  resolveChartLayout,
} from './common.js'

export interface DigitalChannelSeries {
  key: string
  label: string
  field: string
  color?: RgbaColor
  lineWidth?: number
  visible?: boolean
  gapThreshold?: number
  stateLabels?: Record<number, string>
}

export interface DigitalChannelDataSet {
  timestamps: Float64Array
  columns: Record<string, Float64Array>
  channels: readonly DigitalChannelSeries[]
}

export interface DigitalChannelRenderOptions {
  xRange?: NumericRange
  gapThreshold?: number
  defaultColor?: RgbaColor
  defaultLineWidth?: number
  includeHidden?: boolean
  channelHeight?: number
  channelGap?: number
}

export interface DigitalChannelSegment {
  buffer: Float32Array
  pointCount: number
}

export interface DigitalChannelPlannedSeries {
  key: string
  label: string
  field: string
  laneIndex: number
  lowY: number
  highY: number
  style: LineOptions
  stateLabels?: Record<number, string>
  segments: readonly DigitalChannelSegment[]
  sourcePointCount: number
  includedSampleCount: number
  renderedPointCount: number
  droppedPointCount: number
}

export interface DigitalChannelRenderPlan {
  kind: 'digital-channel'
  xRange: NumericRange
  xOrigin: number
  xRelativeRange: NumericRange
  yRange: NumericRange
  channels: readonly DigitalChannelPlannedSeries[]
  sourcePointCount: number
  includedSampleCount: number
  renderedPointCount: number
  segmentCount: number
  warnings: readonly string[]
}

export interface DigitalChannelFrameOptions {
  layout?: ChartLayout | ChartLayoutOptions
  guides?: ChartGuideOptions | false
}

export interface DigitalChannelCommandFrame {
  width: number
  height: number
  layout: ChartLayout | null
  commands: RenderCommandList
  transform: ViewTransform
}

interface DigitalSegmentBuildResult {
  segments: DigitalChannelSegment[]
  includedSampleCount: number
  renderedPointCount: number
}

export function buildDigitalChannelRenderPlan(
  data: DigitalChannelDataSet,
  options: DigitalChannelRenderOptions = {},
): DigitalChannelRenderPlan {
  const xRange = options.xRange ? normalizeRange(options.xRange) : finiteRange(data.timestamps)
  const xOrigin = xRange[0]
  const xRelativeRange = relativeRange(xRange, xOrigin)
  const channelHeight = options.channelHeight ?? 1
  const channelGap = options.channelGap ?? 0.5
  const channels: DigitalChannelPlannedSeries[] = []
  const warnings: string[] = []
  let sourcePointCount = 0
  let includedSampleCount = 0
  let renderedPointCount = 0
  let segmentCount = 0

  for (let sourceIndex = 0; sourceIndex < data.channels.length; sourceIndex++) {
    const channel = data.channels[sourceIndex] as DigitalChannelSeries
    if (channel.visible === false && options.includeHidden !== true) continue

    const values = data.columns[channel.field]
    if (!values) {
      warnings.push(
        `Channel "${channel.key}" skipped because column "${channel.field}" is missing.`,
      )
      continue
    }

    const pointCount = Math.min(data.timestamps.length, values.length)
    if (data.timestamps.length !== values.length) {
      warnings.push(
        `Channel "${channel.key}" uses ${pointCount} points because timestamp and value lengths differ.`,
      )
    }

    const laneIndex = channels.length
    const lowY = laneIndex * (channelHeight + channelGap)
    const highY = lowY + channelHeight
    const build = buildDigitalSegments(data.timestamps, values, {
      pointCount,
      xRange,
      xOrigin,
      lowY,
      highY,
      gapThreshold: channel.gapThreshold ?? options.gapThreshold ?? 0,
    })
    const plannedChannel: DigitalChannelPlannedSeries = {
      key: channel.key,
      label: channel.label,
      field: channel.field,
      laneIndex,
      lowY,
      highY,
      style: {
        color: channel.color ?? getDefaultColor(sourceIndex, options.defaultColor),
        width: channel.lineWidth ?? options.defaultLineWidth ?? 1.5,
      },
      segments: build.segments,
      sourcePointCount: pointCount,
      includedSampleCount: build.includedSampleCount,
      renderedPointCount: build.renderedPointCount,
      droppedPointCount: pointCount - build.includedSampleCount,
    }

    if (channel.stateLabels) {
      plannedChannel.stateLabels = channel.stateLabels
    }

    sourcePointCount += pointCount
    includedSampleCount += build.includedSampleCount
    renderedPointCount += build.renderedPointCount
    segmentCount += build.segments.length
    channels.push(plannedChannel)
  }

  const laneCount = Math.max(1, channels.length)
  const yMax = (laneCount - 1) * (channelHeight + channelGap) + channelHeight + channelGap

  return {
    kind: 'digital-channel',
    xRange,
    xOrigin,
    xRelativeRange,
    yRange: [-channelGap, yMax],
    channels,
    sourcePointCount,
    includedSampleCount,
    renderedPointCount,
    segmentCount,
    warnings,
  }
}

export function addDigitalChannelToCommandList(
  commands: RenderCommandList,
  plan: DigitalChannelRenderPlan,
  z: ZLayer = ZLayer.Line,
): void {
  for (const channel of plan.channels) {
    for (const segment of channel.segments) {
      commands.addLine(segment.buffer, channel.style, z)
    }
  }
}

export function createDigitalChannelViewTransform(
  plan: DigitalChannelRenderPlan,
  width: number,
  height: number,
): ViewTransform {
  return createViewportTransform(plan.xRelativeRange, plan.yRange, width, height)
}

export function buildDigitalChannelCommandFrame(
  plan: DigitalChannelRenderPlan,
  width: number,
  height: number,
  options: DigitalChannelFrameOptions = {},
): DigitalChannelCommandFrame {
  const layout = resolveChartLayout(options.layout, width, height, plan.xRelativeRange, plan.yRange)
  const commands = new RenderCommandList()
  if (layout && options.guides !== false) {
    addChartGuidesToCommandList(commands, layout, plan.xRelativeRange, plan.yRange, options.guides)
  }
  addDigitalChannelToCommandList(commands, plan)

  return {
    width,
    height,
    layout,
    commands,
    transform: layout
      ? createPlotViewportTransform(
          plan.xRelativeRange,
          plan.yRange,
          width,
          height,
          layout.plotArea,
        )
      : createDigitalChannelViewTransform(plan, width, height),
  }
}

export function renderDigitalChannelPlan(
  context: RenderContext,
  plan: DigitalChannelRenderPlan,
  options: DigitalChannelFrameOptions = {},
): void {
  const frame = buildDigitalChannelCommandFrame(plan, context.width, context.height, options)
  context.setTransform(frame.transform)
  context.beginFrame()
  drawCommandList(context, frame.commands)
  context.endFrame()
}

function buildDigitalSegments(
  timestamps: Float64Array,
  values: Float64Array,
  options: {
    pointCount: number
    xRange: NumericRange
    xOrigin: number
    lowY: number
    highY: number
    gapThreshold: number
  },
): DigitalSegmentBuildResult {
  const scratch = new Float32Array(Math.max(0, options.pointCount * 4 - 2))
  const segments: DigitalChannelSegment[] = []
  let write = 0
  let segmentStart = 0
  let segmentPointCount = 0
  let includedSampleCount = 0
  let renderedPointCount = 0
  let previousX = 0
  let previousY = 0

  const pushSegment = () => {
    if (segmentPointCount >= 2) {
      const buffer = scratch.subarray(segmentStart, write)
      segments.push({ buffer, pointCount: segmentPointCount })
      renderedPointCount += segmentPointCount
    }
    segmentPointCount = 0
    segmentStart = write
  }

  const appendPoint = (x: number, y: number) => {
    scratch[write++] = x
    scratch[write++] = y
    segmentPointCount += 1
  }

  for (let i = 0; i < options.pointCount; i++) {
    const timestamp = timestamps[i]
    const value = values[i]
    if (
      !isFiniteNumber(timestamp) ||
      !isFiniteNumber(value) ||
      timestamp < options.xRange[0] ||
      timestamp > options.xRange[1]
    ) {
      pushSegment()
      continue
    }

    const x = timestamp - options.xOrigin
    const y = value > 0 ? options.highY : options.lowY
    const previousTimestamp = previousX + options.xOrigin
    const gapBreak =
      segmentPointCount > 0 &&
      options.gapThreshold > 0 &&
      timestamp - previousTimestamp > options.gapThreshold

    if (gapBreak) {
      pushSegment()
    }

    if (segmentPointCount === 0) {
      segmentStart = write
      appendPoint(x, y)
    } else {
      appendPoint(x, previousY)
      appendPoint(x, y)
    }

    includedSampleCount += 1
    previousX = x
    previousY = y
  }

  pushSegment()

  return {
    segments,
    includedSampleCount,
    renderedPointCount,
  }
}
