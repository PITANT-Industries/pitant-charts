import type { RenderCommandList } from '../renderer/render-command-list.js'
import type { RenderContext } from '../renderer/types.js'
import type { ViewTransform } from '../renderer/view-transform.js'
import {
  type ChartGuideOptions,
  type ChartLayout,
  type ChartLayoutOptions,
  drawCommandList,
} from './common.js'

export interface ChartCommandFrame {
  width: number
  height: number
  layout: ChartLayout | null
  commands: RenderCommandList
  transform: ViewTransform
}

export interface ChartFramePlugin<TPlan> {
  /** Add renderer-neutral commands. Used for both live drawing and export. */
  extendFrame?: (frame: Readonly<ChartCommandFrame>, plan: Readonly<TPlan>) => void
  /** Runs inside the native render frame, before the chart commands. */
  beforeDraw?: (
    context: RenderContext,
    frame: Readonly<ChartCommandFrame>,
    plan: Readonly<TPlan>,
  ) => void
  /** Runs inside the native render frame, after the chart commands. */
  afterDraw?: (
    context: RenderContext,
    frame: Readonly<ChartCommandFrame>,
    plan: Readonly<TPlan>,
  ) => void
}

export interface ChartFrameOptions<TPlan> {
  layout?: ChartLayout | ChartLayoutOptions
  guides?: ChartGuideOptions | false
  plugins?: readonly ChartFramePlugin<TPlan>[]
}

export function extendChartFrame<TFrame extends ChartCommandFrame, TPlan>(
  frame: TFrame,
  plan: TPlan,
  plugins: readonly ChartFramePlugin<TPlan>[] | undefined,
): TFrame {
  if (plugins) for (const plugin of plugins) plugin.extendFrame?.(frame, plan)
  return frame
}

export function renderChartFrame<TPlan>(
  context: RenderContext,
  frame: ChartCommandFrame,
  plan: TPlan,
  plugins?: readonly ChartFramePlugin<TPlan>[],
  clipPlot = frame.transform.hasProjection,
): void {
  context.setTransform(frame.transform)
  context.beginFrame()
  try {
    if (plugins) {
      for (const plugin of plugins) plugin.beforeDraw?.(context, frame, plan)
      context.setTransform(frame.transform)
    }
    drawCommandList(
      context,
      frame.commands,
      frame.transform,
      clipPlot ? frame.layout?.plotArea : undefined,
    )
    if (plugins) for (const plugin of plugins) plugin.afterDraw?.(context, frame, plan)
  } finally {
    context.endFrame()
  }
}
