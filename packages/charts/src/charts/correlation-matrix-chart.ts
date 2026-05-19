import { createRenderContext } from '../renderer/create-render-context.js'
import type { RenderContext, RendererType } from '../renderer/types.js'
import type {
  CorrelationMatrixDataSet,
  CorrelationMatrixFrameOptions,
  CorrelationMatrixRenderOptions,
  CorrelationMatrixRenderPlan,
} from './correlation-matrix.js'
import {
  buildCorrelationMatrixRenderPlan,
  renderCorrelationMatrixPlan,
} from './correlation-matrix.js'

export interface CorrelationMatrixChartOptions {
  data: CorrelationMatrixDataSet
  render?: CorrelationMatrixRenderOptions
  frame?: CorrelationMatrixFrameOptions
  autoRender?: boolean
  ownsContext?: boolean
}

export interface CorrelationMatrixChartCreateOptions
  extends Omit<CorrelationMatrixChartOptions, 'ownsContext'> {
  renderer?: RendererType | 'auto'
}

export class CorrelationMatrixChart {
  readonly context: RenderContext

  private _data: CorrelationMatrixDataSet
  private _renderOptions: CorrelationMatrixRenderOptions
  private _frameOptions: CorrelationMatrixFrameOptions
  private _renderPlan: CorrelationMatrixRenderPlan
  private _ownsContext: boolean
  private _disposed = false

  constructor(context: RenderContext, options: CorrelationMatrixChartOptions) {
    this.context = context
    this._data = options.data
    this._renderOptions = options.render ?? {}
    this._frameOptions = options.frame ?? {}
    this._ownsContext = options.ownsContext === true
    this._renderPlan = buildCorrelationMatrixRenderPlan(this._data, this._renderOptions)

    if (options.autoRender !== false) {
      this.render()
    }
  }

  static async create(
    canvas: HTMLCanvasElement,
    options: CorrelationMatrixChartCreateOptions,
  ): Promise<CorrelationMatrixChart> {
    const renderContextOptions: { renderer?: RendererType | 'auto' } = {}
    if (options.renderer !== undefined) {
      renderContextOptions.renderer = options.renderer
    }
    const context = await createRenderContext(canvas, renderContextOptions)
    const chartOptions: CorrelationMatrixChartOptions = {
      data: options.data,
      ownsContext: true,
    }
    if (options.render !== undefined) chartOptions.render = options.render
    if (options.frame !== undefined) chartOptions.frame = options.frame
    if (options.autoRender !== undefined) chartOptions.autoRender = options.autoRender
    return new CorrelationMatrixChart(context, chartOptions)
  }

  get data(): CorrelationMatrixDataSet {
    return this._data
  }

  get renderOptions(): CorrelationMatrixRenderOptions {
    return this._renderOptions
  }

  get frameOptions(): CorrelationMatrixFrameOptions {
    return this._frameOptions
  }

  get renderPlan(): CorrelationMatrixRenderPlan {
    return this._renderPlan
  }

  setData(
    data: CorrelationMatrixDataSet,
    renderOptions?: CorrelationMatrixRenderOptions,
  ): CorrelationMatrixRenderPlan {
    this._assertActive()
    this._data = data
    if (renderOptions) {
      this._renderOptions = renderOptions
    }
    return this.render()
  }

  setRenderOptions(renderOptions: CorrelationMatrixRenderOptions): CorrelationMatrixRenderPlan {
    this._assertActive()
    this._renderOptions = renderOptions
    return this.render()
  }

  setFrameOptions(frameOptions: CorrelationMatrixFrameOptions): CorrelationMatrixRenderPlan {
    this._assertActive()
    this._frameOptions = frameOptions
    return this.render()
  }

  resize(width: number, height: number, dpr?: number): CorrelationMatrixRenderPlan {
    this._assertActive()
    this.context.resize(width, height, dpr)
    return this.render()
  }

  render(): CorrelationMatrixRenderPlan {
    this._assertActive()
    this._renderPlan = buildCorrelationMatrixRenderPlan(this._data, this._renderOptions)
    renderCorrelationMatrixPlan(this.context, this._renderPlan, this._frameOptions)
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
      throw new Error('@pitant/charts: CorrelationMatrixChart has been disposed.')
    }
  }
}
