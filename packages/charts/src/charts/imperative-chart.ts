import { createRenderContext } from '../renderer/create-render-context.js'
import type { RenderContext, RendererType } from '../renderer/types.js'
import { type ChartCommandFrame, type ChartFrameOptions, renderChartFrame } from './chart-frame.js'

interface ChartInputs<TData, TRender, TFrame> {
  data: TData
  render: TRender
  frame: TFrame
}

interface ChartOptions<TData, TRender, TFrame> extends ChartInputs<TData, TRender, TFrame> {
  autoRender?: boolean
  ownsContext?: boolean
}

interface ChartPipeline<TData, TRender, TFrame, TPlan> {
  name: string
  buildPlan: (data: TData, options: TRender) => TPlan
  buildFrame: (plan: TPlan, width: number, height: number, options: TFrame) => ChartCommandFrame
  clipPlot?: (plan: TPlan) => boolean
}

interface CachedFrame {
  frame: ChartCommandFrame
  dpr: number
}

type RenderRequest = 'fresh' | 'cached'
type PendingSize = [width: number, height: number, dpr: number | undefined]

/** Shared lifecycle for native charts. Concrete charts supply their data and geometry builders. */
export class ImperativeChart<TData, TRender, TFrame extends ChartFrameOptions<TPlan>, TPlan> {
  readonly context: RenderContext

  private _inputs: ChartInputs<TData, TRender, TFrame>
  private _renderPlan: TPlan
  private _cache: CachedFrame | undefined
  private _batchDepth = 0
  private _pendingRender: RenderRequest | undefined
  private _pendingSize: PendingSize | undefined
  private _disposed = false
  private readonly _ownsContext: boolean

  constructor(
    context: RenderContext,
    options: ChartOptions<TData, TRender, TFrame>,
    private readonly _pipeline: ChartPipeline<TData, TRender, TFrame, TPlan>,
  ) {
    this.context = context
    this._inputs = options
    this._ownsContext = options.ownsContext === true
    this._renderPlan = _pipeline.buildPlan(this._inputs.data, this._inputs.render)
    if (options.autoRender !== false) this._draw(false)
  }

  get data(): TData {
    return this._inputs.data
  }

  get renderOptions(): TRender {
    return this._inputs.render
  }

  get frameOptions(): TFrame {
    return this._inputs.frame
  }

  get renderPlan(): TPlan {
    return this._renderPlan
  }

  setData(data: TData, renderOptions?: TRender): TPlan {
    return this._updateInputs({
      ...this._inputs,
      data,
      render: renderOptions ?? this._inputs.render,
    })
  }

  setRenderOptions(renderOptions: TRender): TPlan {
    return this._updateInputs({ ...this._inputs, render: renderOptions })
  }

  setFrameOptions(frameOptions: TFrame): TPlan {
    return this._updateInputs({ ...this._inputs, frame: frameOptions })
  }

  resize(width: number, height: number, dpr?: number): TPlan {
    this._assertActive()
    if (this._batchDepth > 0) this._pendingSize = [width, height, dpr]
    else this.context.resize(width, height, dpr)
    return this.render()
  }

  /** Recalculate the plan and frame. Use this after mutating an input array in place. */
  render(): TPlan {
    return this._requestRender('fresh')
  }

  /** Repaint from existing commands. Size changes regenerate geometry. */
  redraw(): TPlan {
    return this._requestRender('cached')
  }

  /** Release cached commands. The next redraw replans from current inputs. */
  clearCache(): void {
    this._assertActive()
    this._cache = undefined
  }

  /** Apply synchronous updates and draw once after the outermost batch completes. */
  batch(update: (chart: this) => void): TPlan {
    this._assertActive()
    const inputs = this._inputs
    const cache = this._cache
    const pendingRender = this._pendingRender
    const pendingSize = this._pendingSize
    this._batchDepth++
    try {
      update(this)
    } catch (error) {
      this._inputs = inputs
      this._cache = this._disposed ? undefined : cache
      this._pendingRender = pendingRender
      this._pendingSize = pendingSize
      throw error
    } finally {
      this._batchDepth--
    }
    if (this._batchDepth > 0 || this._disposed || !this._pendingRender) return this._renderPlan

    const request = this._pendingRender
    const size = this._pendingSize
    this._pendingRender = undefined
    this._pendingSize = undefined
    try {
      if (size) this.context.resize(...size)
      return this._requestRender(request)
    } catch (error) {
      this._inputs = inputs
      this._cache = cache
      throw error
    }
  }

  dispose(): void {
    if (this._disposed) return
    this._disposed = true
    this._cache = undefined
    this._pendingRender = undefined
    this._pendingSize = undefined
    if (this._ownsContext) this.context.dispose()
  }

  private _updateInputs(inputs: ChartInputs<TData, TRender, TFrame>): TPlan {
    this._assertActive()
    const previous = this._inputs
    this._inputs = inputs
    try {
      return this.render()
    } catch (error) {
      this._inputs = previous
      throw error
    }
  }

  private _requestRender(request: RenderRequest): TPlan {
    this._assertActive()
    if (this._batchDepth > 0) {
      if (this._pendingRender !== 'fresh') this._pendingRender = request
      return this._renderPlan
    }
    return this._draw(request === 'fresh' || this._cache === undefined)
  }

  private _draw(replan: boolean): TPlan {
    const plan = replan
      ? this._pipeline.buildPlan(this._inputs.data, this._inputs.render)
      : this._renderPlan
    const { width, height, dpr } = this.context
    const cached = replan ? undefined : this._cache
    const frame =
      cached?.dpr === dpr && cached.frame.width === width && cached.frame.height === height
        ? cached.frame
        : this._pipeline.buildFrame(plan, width, height, this._inputs.frame)
    renderChartFrame(
      this.context,
      frame,
      plan,
      this._inputs.frame.plugins,
      this._pipeline.clipPlot?.(plan) || frame.transform.hasProjection,
    )
    this._renderPlan = plan
    this._cache = { frame, dpr }
    return plan
  }

  private _assertActive(): void {
    if (this._disposed) throw new Error(`@pitant/charts: ${this._pipeline.name} has been disposed.`)
  }
}

export async function createImperativeChart<TOptions extends { ownsContext?: boolean }, TChart>(
  Chart: new (context: RenderContext, options: TOptions) => TChart,
  canvas: HTMLCanvasElement,
  options: TOptions & { renderer?: RendererType | 'auto' },
): Promise<TChart> {
  const context = await createRenderContext(
    canvas,
    options.renderer ? { renderer: options.renderer } : {},
  )
  try {
    return new Chart(context, { ...options, ownsContext: true })
  } catch (error) {
    context.dispose()
    throw error
  }
}
