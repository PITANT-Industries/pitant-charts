import { createRenderContext } from '../renderer/create-render-context.js'
import type { RenderContext, RendererType } from '../renderer/types.js'
import type {
  TimeSeriesDataSet,
  TimeSeriesFrameOptions,
  TimeSeriesRenderOptions,
  TimeSeriesRenderPlan,
} from './time-series.js'
import { buildTimeSeriesRenderPlan, renderTimeSeriesPlan } from './time-series.js'

export interface TimeSeriesChartOptions {
  data: TimeSeriesDataSet
  render?: TimeSeriesRenderOptions
  frame?: TimeSeriesFrameOptions
  autoRender?: boolean
  ownsContext?: boolean
}

export interface TimeSeriesChartCreateOptions extends Omit<TimeSeriesChartOptions, 'ownsContext'> {
  renderer?: RendererType | 'auto'
}

export class TimeSeriesChart {
  readonly context: RenderContext

  private _data: TimeSeriesDataSet
  private _renderOptions: TimeSeriesRenderOptions
  private _frameOptions: TimeSeriesFrameOptions
  private _renderPlan: TimeSeriesRenderPlan
  private _ownsContext: boolean
  private _disposed = false

  constructor(context: RenderContext, options: TimeSeriesChartOptions) {
    this.context = context
    this._data = options.data
    this._renderOptions = options.render ?? {}
    this._frameOptions = options.frame ?? {}
    this._ownsContext = options.ownsContext === true
    this._renderPlan = buildTimeSeriesRenderPlan(this._data, this._renderOptions)

    if (options.autoRender !== false) {
      this.render()
    }
  }

  static async create(
    canvas: HTMLCanvasElement,
    options: TimeSeriesChartCreateOptions,
  ): Promise<TimeSeriesChart> {
    const renderContextOptions: { renderer?: RendererType | 'auto' } = {}
    if (options.renderer !== undefined) {
      renderContextOptions.renderer = options.renderer
    }
    const context = await createRenderContext(canvas, renderContextOptions)
    const chartOptions: TimeSeriesChartOptions = {
      data: options.data,
      ownsContext: true,
    }
    if (options.render !== undefined) chartOptions.render = options.render
    if (options.frame !== undefined) chartOptions.frame = options.frame
    if (options.autoRender !== undefined) chartOptions.autoRender = options.autoRender
    return new TimeSeriesChart(context, chartOptions)
  }

  get data(): TimeSeriesDataSet {
    return this._data
  }

  get renderOptions(): TimeSeriesRenderOptions {
    return this._renderOptions
  }

  get frameOptions(): TimeSeriesFrameOptions {
    return this._frameOptions
  }

  get renderPlan(): TimeSeriesRenderPlan {
    return this._renderPlan
  }

  setData(data: TimeSeriesDataSet, renderOptions?: TimeSeriesRenderOptions): TimeSeriesRenderPlan {
    this._assertActive()
    this._data = data
    if (renderOptions) {
      this._renderOptions = renderOptions
    }
    return this.render()
  }

  setRenderOptions(renderOptions: TimeSeriesRenderOptions): TimeSeriesRenderPlan {
    this._assertActive()
    this._renderOptions = renderOptions
    return this.render()
  }

  setFrameOptions(frameOptions: TimeSeriesFrameOptions): TimeSeriesRenderPlan {
    this._assertActive()
    this._frameOptions = frameOptions
    return this.render()
  }

  resize(width: number, height: number, dpr?: number): TimeSeriesRenderPlan {
    this._assertActive()
    this.context.resize(width, height, dpr)
    return this.render()
  }

  render(): TimeSeriesRenderPlan {
    this._assertActive()
    this._renderPlan = buildTimeSeriesRenderPlan(this._data, this._renderOptions)
    renderTimeSeriesPlan(this.context, this._renderPlan, this._frameOptions)
    return this._renderPlan
  }

  dispose(): void {
    if (this._disposed) return
    if (this._ownsContext) {
      this.context.dispose()
    }
    this._disposed = true
  }

  private _assertActive(): void {
    if (this._disposed) {
      throw new Error('@pitant/charts: TimeSeriesChart has been disposed.')
    }
  }
}
