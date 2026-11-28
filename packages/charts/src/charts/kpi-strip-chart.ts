import type { RenderContext, RendererType } from '../renderer/types.js'
import { createImperativeChart, ImperativeChart } from './imperative-chart.js'
import type {
  KpiStripDataSet,
  KpiStripFrameOptions,
  KpiStripRenderOptions,
  KpiStripRenderPlan,
} from './kpi-strip.js'
import { buildKpiStripCommandFrame, buildKpiStripRenderPlan } from './kpi-strip.js'

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

export class KpiStripChart extends ImperativeChart<
  KpiStripDataSet,
  KpiStripRenderOptions,
  KpiStripFrameOptions,
  KpiStripRenderPlan
> {
  constructor(context: RenderContext, options: KpiStripChartOptions) {
    super(
      context,
      { ...options, render: options.render ?? {}, frame: options.frame ?? {} },
      {
        name: 'KpiStripChart',
        buildPlan: buildKpiStripRenderPlan,
        buildFrame: buildKpiStripCommandFrame,
      },
    )
  }

  static create(
    canvas: HTMLCanvasElement,
    options: KpiStripChartCreateOptions,
  ): Promise<KpiStripChart> {
    return createImperativeChart(KpiStripChart, canvas, options)
  }
}
