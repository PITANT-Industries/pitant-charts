import type { RenderContext, RendererType } from '../renderer/types.js'
import type {
  CorrelationMatrixDataSet,
  CorrelationMatrixFrameOptions,
  CorrelationMatrixRenderOptions,
  CorrelationMatrixRenderPlan,
} from './correlation-matrix.js'
import {
  buildCorrelationMatrixCommandFrame,
  buildCorrelationMatrixRenderPlan,
} from './correlation-matrix.js'
import { createImperativeChart, ImperativeChart } from './imperative-chart.js'

export interface CorrelationMatrixChartOptions {
  data: CorrelationMatrixDataSet
  render?: CorrelationMatrixRenderOptions
  frame?: CorrelationMatrixFrameOptions
  autoRender?: boolean
  ownsContext?: boolean
}

export interface CorrelationMatrixChartCreateOptions
  extends Omit<CorrelationMatrixChartOptions, 'ownsContext'> {
  renderer?: RendererType | 'auto'
}

export class CorrelationMatrixChart extends ImperativeChart<
  CorrelationMatrixDataSet,
  CorrelationMatrixRenderOptions,
  CorrelationMatrixFrameOptions,
  CorrelationMatrixRenderPlan
> {
  constructor(context: RenderContext, options: CorrelationMatrixChartOptions) {
    super(
      context,
      { ...options, render: options.render ?? {}, frame: options.frame ?? {} },
      {
        name: 'CorrelationMatrixChart',
        buildPlan: buildCorrelationMatrixRenderPlan,
        buildFrame: buildCorrelationMatrixCommandFrame,
      },
    )
  }

  static create(
    canvas: HTMLCanvasElement,
    options: CorrelationMatrixChartCreateOptions,
  ): Promise<CorrelationMatrixChart> {
    return createImperativeChart(CorrelationMatrixChart, canvas, options)
  }
}
