import { createRenderContext } from '../renderer/create-render-context.js'
import type { RenderContext, RendererType } from '../renderer/types.js'
import type {
  KpiStripDataSet,
  KpiStripFrameOptions,
  KpiStripRenderOptions,
  KpiStripRenderPlan,
} from './kpi-strip.js'
import { buildKpiStripRenderPlan, renderKpiStripPlan } from './kpi-strip.js'

export interface KpiStripChartOptions {
  data: KpiStripDataSet
  render?: KpiStripRenderOptions
  frame?: KpiStripFrameOptions
  autoRender?: boolean
  ownsContext?: boolean
}

export interface KpiStripChartCreateOptions extends Omit<KpiStripChartOptions, 'ownsContext'> {
  renderer?: RendererType | 'auto'
}

export class KpiStripChart {
  readonly context: RenderContext
  private _data: KpiStripDataSet
  private _renderOptions: KpiStripRenderOptions
  private _frameOptions: KpiStripFrameOptions
  private _renderPlan: KpiStripRenderPlan
  private _disposed = false
  private _ownsContext: boolean

  constructor(context: RenderContext, options: KpiStripChartOptions) {
    this.context = context
    this._data = options.data
    this._renderOptions = options.render ?? {}
    this._frameOptions = options.frame ?? {}
    this._ownsContext = options.ownsContext === true
    this._renderPlan = buildKpiStripRenderPlan(this._data, this._renderOptions)

    if (options.autoRender !== false) {
      this.render()
    }
  }

  static async create(
    canvas: HTMLCanvasElement,
    options: KpiStripChartCreateOptions,
  ): Promise<KpiStripChart> {
    const renderContextOptions: { renderer?: RendererType | 'auto' } = {}
    if (options.renderer !== undefined) {
      renderContextOptions.renderer = options.renderer
    }
    const context = await createRenderContext(canvas, renderContextOptions)
    const chartOptions: KpiStripChartOptions = {
      data: options.data,
      ownsContext: true,
    }
    if (options.render !== undefined) chartOptions.render = options.render
    if (options.frame !== undefined) chartOptions.frame = options.frame
    if (options.autoRender !== undefined) chartOptions.autoRender = options.autoRender
    return new KpiStripChart(context, chartOptions)
  }

  get data(): KpiStripDataSet {
    return this._data
  }

  get renderOptions(): KpiStripRenderOptions {
    return this._renderOptions
  }

  get frameOptions(): KpiStripFrameOptions {
    return this._frameOptions
  }

  get renderPlan(): KpiStripRenderPlan {
    return this._renderPlan
  }

  setData(data: KpiStripDataSet, renderOptions?: KpiStripRenderOptions): KpiStripRenderPlan {
    this._assertAlive()
    this._data = data
    if (renderOptions !== undefined) this._renderOptions = renderOptions
    return this.render()
  }

  setRenderOptions(renderOptions: KpiStripRenderOptions): KpiStripRenderPlan {
    this._assertAlive()
    this._renderOptions = renderOptions
    return this.render()
  }

  setFrameOptions(frameOptions: KpiStripFrameOptions): KpiStripRenderPlan {
    this._assertAlive()
    this._frameOptions = frameOptions
    return this.render()
  }

  resize(width: number, height: number, dpr?: number): KpiStripRenderPlan {
    this._assertAlive()
    this.context.resize(width, height, dpr)
    return this.render()
  }

  render(): KpiStripRenderPlan {
    this._assertAlive()
    this._renderPlan = buildKpiStripRenderPlan(this._data, this._renderOptions)
    renderKpiStripPlan(this.context, this._renderPlan, this._frameOptions)
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
      throw new Error('@pitant/charts: KpiStripChart has been disposed.')
    }
  }
}
