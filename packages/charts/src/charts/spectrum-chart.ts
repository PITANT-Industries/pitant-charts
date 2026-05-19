import { createRenderContext } from '../renderer/create-render-context.js'
import type { RenderContext, RendererType } from '../renderer/types.js'
import type {
  SpectrumDataSet,
  SpectrumFrameOptions,
  SpectrumRenderOptions,
  SpectrumRenderPlan,
} from './spectrum.js'
import { buildSpectrumRenderPlan, renderSpectrumPlan } from './spectrum.js'

export interface SpectrumChartOptions {
  data: SpectrumDataSet
  render?: SpectrumRenderOptions
  frame?: SpectrumFrameOptions
  autoRender?: boolean
  ownsContext?: boolean
}

export interface SpectrumChartCreateOptions extends Omit<SpectrumChartOptions, 'ownsContext'> {
  renderer?: RendererType | 'auto'
}

export class SpectrumChart {
  readonly context: RenderContext

  private _data: SpectrumDataSet
  private _renderOptions: SpectrumRenderOptions
  private _frameOptions: SpectrumFrameOptions
  private _renderPlan: SpectrumRenderPlan
  private _ownsContext: boolean
  private _disposed = false

  constructor(context: RenderContext, options: SpectrumChartOptions) {
    this.context = context
    this._data = options.data
    this._renderOptions = options.render ?? {}
    this._frameOptions = options.frame ?? {}
    this._ownsContext = options.ownsContext === true
    this._renderPlan = buildSpectrumRenderPlan(this._data, this._renderOptions)

    if (options.autoRender !== false) {
      this.render()
    }
  }

  static async create(
    canvas: HTMLCanvasElement,
    options: SpectrumChartCreateOptions,
  ): Promise<SpectrumChart> {
    const renderContextOptions: { renderer?: RendererType | 'auto' } = {}
    if (options.renderer !== undefined) {
      renderContextOptions.renderer = options.renderer
    }
    const context = await createRenderContext(canvas, renderContextOptions)
    const chartOptions: SpectrumChartOptions = {
      data: options.data,
      ownsContext: true,
    }
    if (options.render !== undefined) chartOptions.render = options.render
    if (options.frame !== undefined) chartOptions.frame = options.frame
    if (options.autoRender !== undefined) chartOptions.autoRender = options.autoRender
    return new SpectrumChart(context, chartOptions)
  }

  get data(): SpectrumDataSet {
    return this._data
  }

  get renderOptions(): SpectrumRenderOptions {
    return this._renderOptions
  }

  get frameOptions(): SpectrumFrameOptions {
    return this._frameOptions
  }

  get renderPlan(): SpectrumRenderPlan {
    return this._renderPlan
  }

  setData(data: SpectrumDataSet, renderOptions?: SpectrumRenderOptions): SpectrumRenderPlan {
    this._assertActive()
    this._data = data
    if (renderOptions) {
      this._renderOptions = renderOptions
    }
    return this.render()
  }

  setRenderOptions(renderOptions: SpectrumRenderOptions): SpectrumRenderPlan {
    this._assertActive()
    this._renderOptions = renderOptions
    return this.render()
  }

  setFrameOptions(frameOptions: SpectrumFrameOptions): SpectrumRenderPlan {
    this._assertActive()
    this._frameOptions = frameOptions
    return this.render()
  }

  resize(width: number, height: number, dpr?: number): SpectrumRenderPlan {
    this._assertActive()
    this.context.resize(width, height, dpr)
    return this.render()
  }

  render(): SpectrumRenderPlan {
    this._assertActive()
    this._renderPlan = buildSpectrumRenderPlan(this._data, this._renderOptions)
    renderSpectrumPlan(this.context, this._renderPlan, this._frameOptions)
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
      throw new Error('@pitant/charts: SpectrumChart has been disposed.')
    }
  }
}
