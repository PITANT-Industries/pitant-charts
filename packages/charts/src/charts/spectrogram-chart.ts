import { createRenderContext } from '../renderer/create-render-context.js'
import type { RenderContext, RendererType } from '../renderer/types.js'
import type {
  SpectrogramDataSet,
  SpectrogramFrameOptions,
  SpectrogramRenderOptions,
  SpectrogramRenderPlan,
} from './spectrogram.js'
import { buildSpectrogramRenderPlan, renderSpectrogramPlan } from './spectrogram.js'

export interface SpectrogramChartOptions {
  data: SpectrogramDataSet
  render?: SpectrogramRenderOptions
  frame?: SpectrogramFrameOptions
  autoRender?: boolean
  ownsContext?: boolean
}

export interface SpectrogramChartCreateOptions
  extends Omit<SpectrogramChartOptions, 'ownsContext'> {
  renderer?: RendererType | 'auto'
}

export class SpectrogramChart {
  readonly context: RenderContext

  private _data: SpectrogramDataSet
  private _renderOptions: SpectrogramRenderOptions
  private _frameOptions: SpectrogramFrameOptions
  private _renderPlan: SpectrogramRenderPlan
  private _ownsContext: boolean
  private _disposed = false

  constructor(context: RenderContext, options: SpectrogramChartOptions) {
    this.context = context
    this._data = options.data
    this._renderOptions = options.render ?? {}
    this._frameOptions = options.frame ?? {}
    this._ownsContext = options.ownsContext === true
    this._renderPlan = buildSpectrogramRenderPlan(this._data, this._renderOptions)

    if (options.autoRender !== false) {
      this.render()
    }
  }

  static async create(
    canvas: HTMLCanvasElement,
    options: SpectrogramChartCreateOptions,
  ): Promise<SpectrogramChart> {
    const renderContextOptions: { renderer?: RendererType | 'auto' } = {}
    if (options.renderer !== undefined) {
      renderContextOptions.renderer = options.renderer
    }
    const context = await createRenderContext(canvas, renderContextOptions)
    const chartOptions: SpectrogramChartOptions = {
      data: options.data,
      ownsContext: true,
    }
    if (options.render !== undefined) chartOptions.render = options.render
    if (options.frame !== undefined) chartOptions.frame = options.frame
    if (options.autoRender !== undefined) chartOptions.autoRender = options.autoRender
    return new SpectrogramChart(context, chartOptions)
  }

  get data(): SpectrogramDataSet {
    return this._data
  }

  get renderOptions(): SpectrogramRenderOptions {
    return this._renderOptions
  }

  get frameOptions(): SpectrogramFrameOptions {
    return this._frameOptions
  }

  get renderPlan(): SpectrogramRenderPlan {
    return this._renderPlan
  }

  setData(
    data: SpectrogramDataSet,
    renderOptions?: SpectrogramRenderOptions,
  ): SpectrogramRenderPlan {
    this._assertActive()
    this._data = data
    if (renderOptions) {
      this._renderOptions = renderOptions
    }
    return this.render()
  }

  setRenderOptions(renderOptions: SpectrogramRenderOptions): SpectrogramRenderPlan {
    this._assertActive()
    this._renderOptions = renderOptions
    return this.render()
  }

  setFrameOptions(frameOptions: SpectrogramFrameOptions): SpectrogramRenderPlan {
    this._assertActive()
    this._frameOptions = frameOptions
    return this.render()
  }

  resize(width: number, height: number, dpr?: number): SpectrogramRenderPlan {
    this._assertActive()
    this.context.resize(width, height, dpr)
    return this.render()
  }

  render(): SpectrogramRenderPlan {
    this._assertActive()
    this._renderPlan = buildSpectrogramRenderPlan(this._data, this._renderOptions)
    renderSpectrogramPlan(this.context, this._renderPlan, this._frameOptions)
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
      throw new Error('@pitant/charts: SpectrogramChart has been disposed.')
    }
  }
}
