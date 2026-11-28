import type { RenderContext, RendererType } from '../renderer/types.js'
import { createImperativeChart, ImperativeChart } from './imperative-chart.js'
import type {
  TimeSeriesBand,
  TimeSeriesDataSet,
  TimeSeriesFrameOptions,
  TimeSeriesRenderOptions,
  TimeSeriesRenderPlan,
  TimeSeriesSeries,
} from './time-series.js'
import { buildTimeSeriesCommandFrame, buildTimeSeriesRenderPlan } from './time-series.js'

export interface TimeSeriesChartOptions {
  data: TimeSeriesDataSet
  render?: TimeSeriesRenderOptions
  frame?: TimeSeriesFrameOptions
  autoRender?: boolean
  ownsContext?: boolean
}

export interface TimeSeriesChartCreateOptions extends Omit<TimeSeriesChartOptions, 'ownsContext'> {
  renderer?: RendererType | 'auto'
}

export class TimeSeriesChart extends ImperativeChart<
  TimeSeriesDataSet,
  TimeSeriesRenderOptions,
  TimeSeriesFrameOptions,
  TimeSeriesRenderPlan
> {
  constructor(context: RenderContext, options: TimeSeriesChartOptions) {
    super(
      context,
      { ...options, render: options.render ?? {}, frame: options.frame ?? {} },
      {
        name: 'TimeSeriesChart',
        buildPlan: buildTimeSeriesRenderPlan,
        buildFrame: buildTimeSeriesCommandFrame,
        clipPlot: (plan) => Boolean(plan.yAxes?.length),
      },
    )
  }

  static create(
    canvas: HTMLCanvasElement,
    options: TimeSeriesChartCreateOptions,
  ): Promise<TimeSeriesChart> {
    return createImperativeChart(TimeSeriesChart, canvas, options)
  }

  addSeries(series: TimeSeriesSeries): TimeSeriesRenderPlan {
    assertAvailableKey(this.data.series, series.key, 'series')
    return this.setData({ ...this.data, series: [...this.data.series, series] })
  }

  updateSeries(key: string, changes: Partial<Omit<TimeSeriesSeries, 'key'>>): TimeSeriesRenderPlan {
    const series = this.data.series.slice()
    const index = findKeyIndex(series, key, 'series')
    const previous = series[index] as TimeSeriesSeries
    series[index] = { ...previous, ...changes, key }
    return this.setData({ ...this.data, series })
  }

  removeSeries(key: string): TimeSeriesRenderPlan {
    const index = findKeyIndex(this.data.series, key, 'series')
    return this.setData({ ...this.data, series: this.data.series.filter((_, i) => i !== index) })
  }

  addBand(band: TimeSeriesBand): TimeSeriesRenderPlan {
    const bands = this.data.bands ?? []
    assertAvailableKey(bands, band.key, 'band')
    return this.setData({ ...this.data, bands: [...bands, band] })
  }

  /** Replace the band with the same key, including changing its shape if needed. */
  updateBand(band: TimeSeriesBand): TimeSeriesRenderPlan {
    const bands = this.data.bands?.slice() ?? []
    bands[findKeyIndex(bands, band.key, 'band')] = band
    return this.setData({ ...this.data, bands })
  }

  removeBand(key: string): TimeSeriesRenderPlan {
    const bands = this.data.bands ?? []
    const index = findKeyIndex(bands, key, 'band')
    return this.setData({ ...this.data, bands: bands.filter((_, i) => i !== index) })
  }
}

function assertAvailableKey(
  items: readonly { key: string }[],
  key: string,
  kind: 'series' | 'band',
): void {
  if (items.some((item) => item.key === key)) {
    throw new RangeError(`@pitant/charts: A ${kind} with key "${key}" already exists.`)
  }
}

function findKeyIndex(
  items: readonly { key: string }[],
  key: string,
  kind: 'series' | 'band',
): number {
  const index = items.findIndex((item) => item.key === key)
  if (index === -1) {
    throw new RangeError(`@pitant/charts: No ${kind} with key "${key}" exists.`)
  }
  return index
}
