import type { RenderContext, RendererType } from '../renderer/types.js'
import { createImperativeChart, ImperativeChart } from './imperative-chart.js'
import type {
  SpectrumDataSet,
  SpectrumFrameOptions,
  SpectrumRenderOptions,
  SpectrumRenderPlan,
} from './spectrum.js'
import { buildSpectrumCommandFrame, buildSpectrumRenderPlan } from './spectrum.js'

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

export class SpectrumChart extends ImperativeChart<
  SpectrumDataSet,
  SpectrumRenderOptions,
  SpectrumFrameOptions,
  SpectrumRenderPlan
> {
  constructor(context: RenderContext, options: SpectrumChartOptions) {
    super(
      context,
      { ...options, render: options.render ?? {}, frame: options.frame ?? {} },
      {
        name: 'SpectrumChart',
        buildPlan: buildSpectrumRenderPlan,
        buildFrame: buildSpectrumCommandFrame,
      },
    )
  }

  static create(
    canvas: HTMLCanvasElement,
    options: SpectrumChartCreateOptions,
  ): Promise<SpectrumChart> {
    return createImperativeChart(SpectrumChart, canvas, options)
  }
}
