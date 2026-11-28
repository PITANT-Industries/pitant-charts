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
  /** Runs when a live chart attaches the plugin. Return a cleanup for resources and listeners. */
  // biome-ignore lint/suspicious/noConfusingVoidType: Void-returning mount handlers are supported.
  mount?: (context: RenderContext) => void | (() => void)
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

type MountablePlugin = Pick<ChartFramePlugin<unknown>, 'mount'>
type PluginCleanup = () => void

/** Owns only live plugin resources. Frame planning and exports remain stateless. */
export class ChartPluginLifecycle {
  private active = new Map<MountablePlugin, PluginCleanup | undefined>()

  constructor(private readonly context: RenderContext) {}

  update(plugins?: readonly MountablePlugin[]): void {
    if (!plugins?.length && !this.active.size) return
    const next = new Map<MountablePlugin, PluginCleanup | undefined>()
    const added: (PluginCleanup | undefined)[] = []
    try {
      for (const plugin of plugins ?? []) {
        if (!plugin.mount || next.has(plugin)) continue
        if (this.active.has(plugin)) {
          next.set(plugin, this.active.get(plugin))
          continue
        }
        const result = plugin.mount(this.context)
        const cleanup = typeof result === 'function' ? result : undefined
        added.push(cleanup)
        next.set(plugin, cleanup)
      }
    } catch (error) {
      cleanupPlugins(added, [error])
      return
    }
    const previous = this.active
    this.active = next
    cleanupPlugins(
      [...previous].flatMap(([plugin, cleanup]) => (next.has(plugin) ? [] : [cleanup])),
    )
  }

  dispose(): void {
    const cleanups = [...this.active.values()]
    this.active.clear()
    cleanupPlugins(cleanups)
  }
}

function cleanupPlugins(cleanups: (PluginCleanup | undefined)[], failures: unknown[] = []): void {
  for (const cleanup of cleanups.reverse()) {
    try {
      cleanup?.()
    } catch (error) {
      failures.push(error)
    }
  }
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) throw new AggregateError(failures, 'Chart plugin lifecycle failed')
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
  clipPlot = frame.transform.hasProjection || frame.transform.rotated,
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
