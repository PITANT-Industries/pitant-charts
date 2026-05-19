import { createRenderContext } from '../renderer/create-render-context.js'
import type { RenderContext, RendererType } from '../renderer/types.js'
import type {
  ScatterPlotDataSet,
  ScatterPlotFrameOptions,
  ScatterPlotRenderOptions,
  ScatterPlotRenderPlan,
} from './scatter-plot.js'
import { buildScatterPlotRenderPlan, renderScatterPlotPlan } from './scatter-plot.js'

export interface ScatterPlotChartOptions {
  data: ScatterPlotDataSet
  render?: ScatterPlotRenderOptions
  frame?: ScatterPlotFrameOptions
  autoRender?: boolean
  ownsContext?: boolean
}

export interface ScatterPlotChartCreateOptions
  extends Omit<ScatterPlotChartOptions, 'ownsContext'> {
  renderer?: RendererType | 'auto'
}

export class ScatterPlotChart {
  readonly context: RenderContext
  private _data: ScatterPlotDataSet
  private _renderOptions: ScatterPlotRenderOptions
  private _frameOptions: ScatterPlotFrameOptions
  private _renderPlan: ScatterPlotRenderPlan
  private _disposed = false
  private _ownsContext: boolean

  constructor(context: RenderContext, options: ScatterPlotChartOptions) {
    this.context = context
    this._data = options.data
    this._renderOptions = options.render ?? {}
    this._frameOptions = options.frame ?? {}
    this._ownsContext = options.ownsContext === true
    this._renderPlan = buildScatterPlotRenderPlan(this._data, this._renderOptions)

    if (options.autoRender !== false) {
      this.render()
    }
  }

  static async create(
    canvas: HTMLCanvasElement,
    options: ScatterPlotChartCreateOptions,
  ): Promise<ScatterPlotChart> {
    const renderContextOptions: { renderer?: RendererType | 'auto' } = {}
    if (options.renderer !== undefined) {
      renderContextOptions.renderer = options.renderer
    }
    const context = await createRenderContext(canvas, renderContextOptions)
    const chartOptions: ScatterPlotChartOptions = {
      data: options.data,
      ownsContext: true,
    }
    if (options.render !== undefined) chartOptions.render = options.render
    if (options.frame !== undefined) chartOptions.frame = options.frame
    if (options.autoRender !== undefined) chartOptions.autoRender = options.autoRender
    return new ScatterPlotChart(context, chartOptions)
  }

  get data(): ScatterPlotDataSet {
    return this._data
  }

  get renderOptions(): ScatterPlotRenderOptions {
    return this._renderOptions
  }

  get frameOptions(): ScatterPlotFrameOptions {
    return this._frameOptions
  }

  get renderPlan(): ScatterPlotRenderPlan {
    return this._renderPlan
  }

  setData(
    data: ScatterPlotDataSet,
    renderOptions?: ScatterPlotRenderOptions,
  ): ScatterPlotRenderPlan {
    this._assertAlive()
    this._data = data
    if (renderOptions !== undefined) this._renderOptions = renderOptions
    return this.render()
  }

  setRenderOptions(renderOptions: ScatterPlotRenderOptions): ScatterPlotRenderPlan {
    this._assertAlive()
    this._renderOptions = renderOptions
    return this.render()
  }

  setFrameOptions(frameOptions: ScatterPlotFrameOptions): ScatterPlotRenderPlan {
    this._assertAlive()
    this._frameOptions = frameOptions
    return this.render()
  }

  resize(width: number, height: number, dpr?: number): ScatterPlotRenderPlan {
    this._assertAlive()
    this.context.resize(width, height, dpr)
    return this.render()
  }

  render(): ScatterPlotRenderPlan {
    this._assertAlive()
    this._renderPlan = buildScatterPlotRenderPlan(this._data, this._renderOptions)
    renderScatterPlotPlan(this.context, this._renderPlan, this._frameOptions)
    return this._renderPlan
  }

  dispose(): void {
    if (this._disposed) return
    this._disposed = true
    if (this._ownsContext) {
      this.context.dispose()
    }
  }

  private _assertAlive(): void {
    if (this._disposed) {
      throw new Error('@pitant/charts: ScatterPlotChart has been disposed.')
    }
  }
}
