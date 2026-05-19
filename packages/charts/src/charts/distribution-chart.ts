import { createRenderContext } from '../renderer/create-render-context.js'
import type { RenderContext, RendererType } from '../renderer/types.js'
import type {
  DistributionDataSet,
  DistributionFrameOptions,
  DistributionRenderOptions,
  DistributionRenderPlan,
} from './distribution.js'
import { buildDistributionRenderPlan, renderDistributionPlan } from './distribution.js'

export interface DistributionChartOptions {
  data: DistributionDataSet
  render?: DistributionRenderOptions
  frame?: DistributionFrameOptions
  autoRender?: boolean
  ownsContext?: boolean
}

export interface DistributionChartCreateOptions
  extends Omit<DistributionChartOptions, 'ownsContext'> {
  renderer?: RendererType | 'auto'
}

export class DistributionChart {
  readonly context: RenderContext

  private _data: DistributionDataSet
  private _renderOptions: DistributionRenderOptions
  private _frameOptions: DistributionFrameOptions
  private _renderPlan: DistributionRenderPlan
  private _ownsContext: boolean
  private _disposed = false

  constructor(context: RenderContext, options: DistributionChartOptions) {
    this.context = context
    this._data = options.data
    this._renderOptions = options.render ?? {}
    this._frameOptions = options.frame ?? {}
    this._ownsContext = options.ownsContext === true
    this._renderPlan = buildDistributionRenderPlan(this._data, this._renderOptions)

    if (options.autoRender !== false) {
      this.render()
    }
  }

  static async create(
    canvas: HTMLCanvasElement,
    options: DistributionChartCreateOptions,
  ): Promise<DistributionChart> {
    const renderContextOptions: { renderer?: RendererType | 'auto' } = {}
    if (options.renderer !== undefined) {
      renderContextOptions.renderer = options.renderer
    }
    const context = await createRenderContext(canvas, renderContextOptions)
    const chartOptions: DistributionChartOptions = {
      data: options.data,
      ownsContext: true,
    }
    if (options.render !== undefined) chartOptions.render = options.render
    if (options.frame !== undefined) chartOptions.frame = options.frame
    if (options.autoRender !== undefined) chartOptions.autoRender = options.autoRender
    return new DistributionChart(context, chartOptions)
  }

  get data(): DistributionDataSet {
    return this._data
  }

  get renderOptions(): DistributionRenderOptions {
    return this._renderOptions
  }

  get frameOptions(): DistributionFrameOptions {
    return this._frameOptions
  }

  get renderPlan(): DistributionRenderPlan {
    return this._renderPlan
  }

  setData(
    data: DistributionDataSet,
    renderOptions?: DistributionRenderOptions,
  ): DistributionRenderPlan {
    this._assertActive()
    this._data = data
    if (renderOptions) {
      this._renderOptions = renderOptions
    }
    return this.render()
  }

  setRenderOptions(renderOptions: DistributionRenderOptions): DistributionRenderPlan {
    this._assertActive()
    this._renderOptions = renderOptions
    return this.render()
  }

  setFrameOptions(frameOptions: DistributionFrameOptions): DistributionRenderPlan {
    this._assertActive()
    this._frameOptions = frameOptions
    return this.render()
  }

  resize(width: number, height: number, dpr?: number): DistributionRenderPlan {
    this._assertActive()
    this.context.resize(width, height, dpr)
    return this.render()
  }

  render(): DistributionRenderPlan {
    this._assertActive()
    this._renderPlan = buildDistributionRenderPlan(this._data, this._renderOptions)
    renderDistributionPlan(this.context, this._renderPlan, this._frameOptions)
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
      throw new Error('@pitant/charts: DistributionChart has been disposed.')
    }
  }
}
