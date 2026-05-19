import { createRenderContext } from '../renderer/create-render-context.js'
import type { RenderContext, RendererType } from '../renderer/types.js'
import type {
  DigitalChannelDataSet,
  DigitalChannelFrameOptions,
  DigitalChannelRenderOptions,
  DigitalChannelRenderPlan,
} from './digital-channel.js'
import { buildDigitalChannelRenderPlan, renderDigitalChannelPlan } from './digital-channel.js'

export interface DigitalChannelChartOptions {
  data: DigitalChannelDataSet
  render?: DigitalChannelRenderOptions
  frame?: DigitalChannelFrameOptions
  autoRender?: boolean
  ownsContext?: boolean
}

export interface DigitalChannelChartCreateOptions
  extends Omit<DigitalChannelChartOptions, 'ownsContext'> {
  renderer?: RendererType | 'auto'
}

export class DigitalChannelChart {
  readonly context: RenderContext

  private _data: DigitalChannelDataSet
  private _renderOptions: DigitalChannelRenderOptions
  private _frameOptions: DigitalChannelFrameOptions
  private _renderPlan: DigitalChannelRenderPlan
  private _ownsContext: boolean
  private _disposed = false

  constructor(context: RenderContext, options: DigitalChannelChartOptions) {
    this.context = context
    this._data = options.data
    this._renderOptions = options.render ?? {}
    this._frameOptions = options.frame ?? {}
    this._ownsContext = options.ownsContext === true
    this._renderPlan = buildDigitalChannelRenderPlan(this._data, this._renderOptions)

    if (options.autoRender !== false) {
      this.render()
    }
  }

  static async create(
    canvas: HTMLCanvasElement,
    options: DigitalChannelChartCreateOptions,
  ): Promise<DigitalChannelChart> {
    const renderContextOptions: { renderer?: RendererType | 'auto' } = {}
    if (options.renderer !== undefined) {
      renderContextOptions.renderer = options.renderer
    }
    const context = await createRenderContext(canvas, renderContextOptions)
    const chartOptions: DigitalChannelChartOptions = {
      data: options.data,
      ownsContext: true,
    }
    if (options.render !== undefined) chartOptions.render = options.render
    if (options.frame !== undefined) chartOptions.frame = options.frame
    if (options.autoRender !== undefined) chartOptions.autoRender = options.autoRender
    return new DigitalChannelChart(context, chartOptions)
  }

  get data(): DigitalChannelDataSet {
    return this._data
  }

  get renderOptions(): DigitalChannelRenderOptions {
    return this._renderOptions
  }

  get frameOptions(): DigitalChannelFrameOptions {
    return this._frameOptions
  }

  get renderPlan(): DigitalChannelRenderPlan {
    return this._renderPlan
  }

  setData(
    data: DigitalChannelDataSet,
    renderOptions?: DigitalChannelRenderOptions,
  ): DigitalChannelRenderPlan {
    this._assertActive()
    this._data = data
    if (renderOptions) {
      this._renderOptions = renderOptions
    }
    return this.render()
  }

  setRenderOptions(renderOptions: DigitalChannelRenderOptions): DigitalChannelRenderPlan {
    this._assertActive()
    this._renderOptions = renderOptions
    return this.render()
  }

  setFrameOptions(frameOptions: DigitalChannelFrameOptions): DigitalChannelRenderPlan {
    this._assertActive()
    this._frameOptions = frameOptions
    return this.render()
  }

  resize(width: number, height: number, dpr?: number): DigitalChannelRenderPlan {
    this._assertActive()
    this.context.resize(width, height, dpr)
    return this.render()
  }

  render(): DigitalChannelRenderPlan {
    this._assertActive()
    this._renderPlan = buildDigitalChannelRenderPlan(this._data, this._renderOptions)
    renderDigitalChannelPlan(this.context, this._renderPlan, this._frameOptions)
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
      throw new Error('@pitant/charts: DigitalChannelChart has been disposed.')
    }
  }
}
