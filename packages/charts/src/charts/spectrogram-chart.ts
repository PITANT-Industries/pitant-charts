import type { RenderContext, RendererType } from '../renderer/types.js'
import { createImperativeChart, ImperativeChart } from './imperative-chart.js'
import type {
  SpectrogramDataSet,
  SpectrogramFrameOptions,
  SpectrogramRenderOptions,
  SpectrogramRenderPlan,
} from './spectrogram.js'
import { buildSpectrogramCommandFrame, buildSpectrogramRenderPlan } from './spectrogram.js'

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

export class SpectrogramChart extends ImperativeChart<
  SpectrogramDataSet,
  SpectrogramRenderOptions,
  SpectrogramFrameOptions,
  SpectrogramRenderPlan
> {
  constructor(context: RenderContext, options: SpectrogramChartOptions) {
    super(
      context,
      { ...options, render: options.render ?? {}, frame: options.frame ?? {} },
      {
        name: 'SpectrogramChart',
        buildPlan: buildSpectrogramRenderPlan,
        buildFrame: buildSpectrogramCommandFrame,
      },
    )
  }

  static create(
    canvas: HTMLCanvasElement,
    options: SpectrogramChartCreateOptions,
  ): Promise<SpectrogramChart> {
    return createImperativeChart(SpectrogramChart, canvas, options)
  }
}
