import type { RenderContext, RendererType } from '../renderer/types.js'
import { createImperativeChart, ImperativeChart } from './imperative-chart.js'
import type {
  ScatterPlotDataSet,
  ScatterPlotFrameOptions,
  ScatterPlotRenderOptions,
  ScatterPlotRenderPlan,
} from './scatter-plot.js'
import { buildScatterPlotCommandFrame, buildScatterPlotRenderPlan } from './scatter-plot.js'

export interface ScatterPlotChartOptions {
  data: ScatterPlotDataSet
  render?: ScatterPlotRenderOptions
  frame?: ScatterPlotFrameOptions
  autoRender?: boolean
  ownsContext?: boolean
}

export interface ScatterPlotChartCreateOptions
  extends Omit<ScatterPlotChartOptions, 'ownsContext'> {
  renderer?: RendererType | 'auto'
}

export class ScatterPlotChart extends ImperativeChart<
  ScatterPlotDataSet,
  ScatterPlotRenderOptions,
  ScatterPlotFrameOptions,
  ScatterPlotRenderPlan
> {
  constructor(context: RenderContext, options: ScatterPlotChartOptions) {
    super(
      context,
      { ...options, render: options.render ?? {}, frame: options.frame ?? {} },
      {
        name: 'ScatterPlotChart',
        buildPlan: buildScatterPlotRenderPlan,
        buildFrame: buildScatterPlotCommandFrame,
      },
    )
  }

  static create(
    canvas: HTMLCanvasElement,
    options: ScatterPlotChartCreateOptions,
  ): Promise<ScatterPlotChart> {
    return createImperativeChart(ScatterPlotChart, canvas, options)
  }
}
