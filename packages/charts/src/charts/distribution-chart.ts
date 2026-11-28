import type { RenderContext, RendererType } from '../renderer/types.js'
import type {
  DistributionDataSet,
  DistributionFrameOptions,
  DistributionRenderOptions,
  DistributionRenderPlan,
} from './distribution.js'
import { buildDistributionCommandFrame, buildDistributionRenderPlan } from './distribution.js'
import { createImperativeChart, ImperativeChart } from './imperative-chart.js'

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

export class DistributionChart extends ImperativeChart<
  DistributionDataSet,
  DistributionRenderOptions,
  DistributionFrameOptions,
  DistributionRenderPlan
> {
  constructor(context: RenderContext, options: DistributionChartOptions) {
    super(
      context,
      { ...options, render: options.render ?? {}, frame: options.frame ?? {} },
      {
        name: 'DistributionChart',
        buildPlan: buildDistributionRenderPlan,
        buildFrame: buildDistributionCommandFrame,
      },
    )
  }

  static create(
    canvas: HTMLCanvasElement,
    options: DistributionChartCreateOptions,
  ): Promise<DistributionChart> {
    return createImperativeChart(DistributionChart, canvas, options)
  }
}
