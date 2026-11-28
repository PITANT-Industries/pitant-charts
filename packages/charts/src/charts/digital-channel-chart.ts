import type { RenderContext, RendererType } from '../renderer/types.js'
import type {
  DigitalChannelDataSet,
  DigitalChannelFrameOptions,
  DigitalChannelRenderOptions,
  DigitalChannelRenderPlan,
} from './digital-channel.js'
import {
  buildDigitalChannelCommandFrame,
  buildDigitalChannelRenderPlan,
} from './digital-channel.js'
import { createImperativeChart, ImperativeChart } from './imperative-chart.js'

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

export class DigitalChannelChart extends ImperativeChart<
  DigitalChannelDataSet,
  DigitalChannelRenderOptions,
  DigitalChannelFrameOptions,
  DigitalChannelRenderPlan
> {
  constructor(context: RenderContext, options: DigitalChannelChartOptions) {
    super(
      context,
      { ...options, render: options.render ?? {}, frame: options.frame ?? {} },
      {
        name: 'DigitalChannelChart',
        buildPlan: buildDigitalChannelRenderPlan,
        buildFrame: buildDigitalChannelCommandFrame,
      },
    )
  }

  static create(
    canvas: HTMLCanvasElement,
    options: DigitalChannelChartCreateOptions,
  ): Promise<DigitalChannelChart> {
    return createImperativeChart(DigitalChannelChart, canvas, options)
  }
}
